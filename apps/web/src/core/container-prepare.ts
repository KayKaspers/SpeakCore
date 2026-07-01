/**
 * Container-Vorbereitung (NDF Step 015): managed Server von RESOURCES_PREPARED → CONTAINER_PENDING.
 *
 * Es wird **kein Docker-Container erstellt/gestartet**. Erzeugt ein starkes Secret (ServerQuery-Admin),
 * speichert es **verschlüsselt** (ADR-0018) und finalisiert die Plan-Namen. Secret erscheint NIE im
 * Client/Log/Audit. Kein Docker-Aufruf, keine Agent-Aktion.
 */
import { createTs3ProvisioningPlan, validateTs3ProvisionInput } from '@speakcore/shared';
import type { Ts3ProvisionInput } from '@speakcore/types';
import { prisma } from './db';
import { logAudit } from './audit';
import { encryptSecret, isEncryptionConfigured } from './crypto';
import { MANAGED_QUERY_USERNAME, generateSecret } from './secret-generator';
import {
  buildContainerPrepareAuditEntries,
  resolveContainerPrepare,
  type ContainerPrepareResult,
} from './container-prepare-helpers';

export * from './container-prepare-helpers';

/**
 * Führt die Container-Vorbereitung durch. OWNER-only wird von der Server Action erzwungen.
 */
export async function prepareManagedContainer(
  serverId: string,
  actor: string,
): Promise<ContainerPrepareResult> {
  const server = await prisma.serverInstance.findUnique({
    where: { id: serverId },
    include: { credential: true },
  });
  if (!server || server.mode !== 'managed') return { status: 'notFound' };

  const gate = resolveContainerPrepare(server.provisioningStatus);
  if (gate === 'alreadyPending') {
    for (const e of buildContainerPrepareAuditEntries('alreadyPending', actor, serverId, false)) {
      await logAudit(e);
    }
    return { status: 'alreadyPending', serverId };
  }
  if (gate === 'invalidState') {
    for (const e of buildContainerPrepareAuditEntries('failed', actor, serverId, false)) await logAudit(e);
    return { status: 'invalidState', serverId };
  }

  // Ohne Verschlüsselung KEIN Secret speichern und Status NICHT ändern.
  if (!isEncryptionConfigured()) {
    for (const e of buildContainerPrepareAuditEntries('failed', actor, serverId, false)) await logAudit(e);
    return { status: 'encryptionMissing', serverId };
  }

  // Plan aus persistierten Werten rekonstruieren und revalidieren (Defense-in-Depth).
  if (!server.instanceId || server.voicePort == null || server.queryPort == null) {
    for (const e of buildContainerPrepareAuditEntries('failed', actor, serverId, false)) await logAudit(e);
    return { status: 'invalidPlan', serverId };
  }
  const input: Ts3ProvisionInput = {
    instanceId: server.instanceId,
    displayName: server.name,
    voicePort: server.voicePort,
    queryPort: server.queryPort,
    fileTransferPort: server.fileTransferPort ?? 30033,
    imageName: 'teamspeak',
    restartPolicy: 'unless-stopped',
    mode: 'expert',
  };
  if (!validateTs3ProvisionInput(input).ok) {
    for (const e of buildContainerPrepareAuditEntries('failed', actor, serverId, false)) await logAudit(e);
    return { status: 'invalidPlan', serverId };
  }
  const plan = createTs3ProvisioningPlan(input);

  // Secret generieren + verschlüsselt speichern (nur wenn noch keine Credentials existieren).
  let secretCreated = false;
  if (!server.credential) {
    const password = generateSecret(32);
    await prisma.serverCredential.create({
      data: {
        serverInstanceId: server.id,
        encryptedUsername: encryptSecret(MANAGED_QUERY_USERNAME),
        encryptedPassword: encryptSecret(password),
      },
    });
    secretCreated = true;
  }

  await prisma.serverInstance.update({
    where: { id: server.id },
    data: {
      provisioningStatus: 'CONTAINER_PENDING',
      lastProvisioningStep: 'PREPARE_CONTAINER',
      lastProvisioningErrorKey: null,
      managedContainerName: plan.container.name,
      managedNetworkName: plan.networks[0].name,
      managedVolumeName: plan.volumes[0].name,
    },
  });

  for (const e of buildContainerPrepareAuditEntries('completed', actor, serverId, secretCreated)) {
    await logAudit(e);
  }
  return { status: 'pending', serverId };
}
