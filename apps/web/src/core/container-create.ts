/**
 * Managed Container erstellen (NDF Step 017): CONTAINER_PENDING → CONTAINER_CREATED.
 *
 * Entschlüsselt das ServerQuery-Admin-Secret **nur serverseitig** und übergibt es dem Agent, der es
 * als Container-ENV setzt (kein Log-Lesen → R-14). **Kein Container-Start.** Secret erscheint NIE im
 * Client/Log/Audit/Ergebnis. OWNER-only wird von der Server Action erzwungen.
 */
import { createTs3ProvisioningPlan, validateTs3ProvisionInput } from '@speakcore/shared';
import type { Ts3ProvisionInput } from '@speakcore/types';
import { prisma } from './db';
import { logAudit } from './audit';
import { decryptSecret, isEncryptionConfigured } from './crypto';
import { createManagedContainer } from '@/lib/agent-client';
import {
  buildContainerCreateAuditEntries,
  containerCreateErrorKey,
  resolveContainerCreate,
  type ContainerCreateServiceResult,
  type ContainerCreateServiceStatus,
} from './container-create-helpers';

export * from './container-create-helpers';

async function fail(
  serverId: string,
  actor: string,
  status: ContainerCreateServiceStatus,
): Promise<ContainerCreateServiceResult> {
  for (const e of buildContainerCreateAuditEntries('failed', actor, serverId)) await logAudit(e);
  return { status, serverId };
}

export async function createManagedContainerForServer(
  serverId: string,
  actor: string,
): Promise<ContainerCreateServiceResult> {
  const server = await prisma.serverInstance.findUnique({
    where: { id: serverId },
    include: { credential: true },
  });
  if (!server || server.mode !== 'managed') return { status: 'notFound' };

  if (resolveContainerCreate(server.provisioningStatus) !== 'ok') {
    return fail(serverId, actor, 'invalidState');
  }

  // Ohne Verschlüsselung kein Secret entschlüsseln → Status NICHT ändern.
  if (!isEncryptionConfigured()) return fail(serverId, actor, 'encryptionMissing');
  if (!server.credential) return fail(serverId, actor, 'credentialMissing');

  // Plan aus persistierten Werten rekonstruieren und revalidieren (Defense-in-Depth).
  if (!server.instanceId || server.voicePort == null || server.queryPort == null) {
    return fail(serverId, actor, 'invalidPlan');
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
  if (!validateTs3ProvisionInput(input).ok) return fail(serverId, actor, 'invalidPlan');
  const plan = createTs3ProvisioningPlan(input);

  // Secret NUR serverseitig entschlüsseln (fehlender/rotierter Schlüssel ⇒ generischer Fehler).
  let username: string;
  let password: string;
  try {
    username = decryptSecret(server.credential.encryptedUsername);
    password = decryptSecret(server.credential.encryptedPassword);
  } catch {
    return fail(serverId, actor, 'invalidPlan');
  }

  const agent = await createManagedContainer({
    input,
    queryAdminUsername: username,
    queryAdminPassword: password,
  });

  if (!agent) {
    await prisma.serverInstance.update({
      where: { id: serverId },
      data: { lastProvisioningStep: 'CREATE_CONTAINER', lastProvisioningErrorKey: 'unreachable' },
    });
    return fail(serverId, actor, 'unreachable');
  }

  if (agent.status === 'created' || agent.status === 'exists') {
    await prisma.serverInstance.update({
      where: { id: serverId },
      data: {
        provisioningStatus: 'CONTAINER_CREATED',
        lastProvisioningStep: 'CREATE_CONTAINER',
        lastProvisioningErrorKey: null,
        managedContainerName: agent.containerName ?? plan.container.name,
      },
    });
    for (const e of buildContainerCreateAuditEntries(agent.status, actor, serverId)) await logAudit(e);
    return { status: agent.status, serverId, containerName: agent.containerName ?? plan.container.name };
  }

  // Fehlerfälle: Status bleibt CONTAINER_PENDING, generischer Fehlerschlüssel, kein Roh-Agent-Detail.
  const svcStatus: ContainerCreateServiceStatus =
    agent.status === 'invalid' ? 'invalidPlan' : agent.status;
  await prisma.serverInstance.update({
    where: { id: serverId },
    data: {
      lastProvisioningStep: 'CREATE_CONTAINER',
      lastProvisioningErrorKey: containerCreateErrorKey(svcStatus),
    },
  });
  const kind = agent.status === 'conflict' ? 'conflict' : 'failed';
  for (const e of buildContainerCreateAuditEntries(kind, actor, serverId)) await logAudit(e);
  return { status: svcStatus, serverId };
}
