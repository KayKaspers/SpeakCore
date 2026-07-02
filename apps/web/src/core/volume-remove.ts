/**
 * Managed Datenvolume entfernen (NDF Step 025). **Datenverlust!** `provisioningStatus` bleibt
 * `RESOURCES_PREPARED`; nur `managedVolumeState='removed'` markiert den Ist-Zustand.
 *
 * Es wird **nur** das managed Volume-Remove (über den Agent) ausgeführt – **kein** Force, **keine** Network-/
 * Container-/Credential-/ServerInstance-Löschung, **kein** Log-Lesen. Voraussetzung: managed Server in
 * `RESOURCES_PREPARED`, alle Bestätigungen (Datenverlust + Backup + getippt `DELETE VOLUME`), und der
 * Agent bestätigt real: kein Container mehr, managed Volume vorhanden. OWNER-only erzwingt die Server Action.
 */
import type { DeprovisionConfirmations } from '@speakcore/types';
import { prisma } from './db';
import { logAudit } from './audit';
import { removeManagedVolume } from '@/lib/agent-client';
import {
  buildVolumeRemoveAuditEntries,
  mapVolumeConfirmationGuard,
  volumeRemoveErrorKey,
  volumeRemoveSuccessUpdate,
  type VolumeRemoveServiceResult,
  type VolumeRemoveServiceStatus,
} from './volume-remove-helpers';

export * from './volume-remove-helpers';

export async function removeManagedVolumeForServer(
  serverId: string,
  actor: string,
  confirmations: DeprovisionConfirmations,
): Promise<VolumeRemoveServiceResult> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server || server.mode !== 'managed') return { status: 'notFound' };

  // Web-Vorprüfung: Status + Bestätigungen (Step-024-Guard). Ohne alle Bestätigungen KEINE Aktion.
  const pre = mapVolumeConfirmationGuard(server.provisioningStatus, confirmations);
  if (pre !== 'ok') {
    for (const e of buildVolumeRemoveAuditEntries({ actor, serverId, confirmed: false, outcome: 'blocked' })) {
      await logAudit(e);
    }
    return { status: pre, serverId };
  }

  if (!server.instanceId) {
    for (const e of buildVolumeRemoveAuditEntries({ actor, serverId, confirmed: false, outcome: 'blocked' })) {
      await logAudit(e);
    }
    return { status: 'invalidPlan', serverId };
  }

  const agent = await removeManagedVolume({ instanceId: server.instanceId });

  if (!agent) {
    await prisma.serverInstance.update({
      where: { id: serverId },
      data: { lastProvisioningStep: 'REMOVE_VOLUME', lastProvisioningErrorKey: 'unreachable' },
    });
    for (const e of buildVolumeRemoveAuditEntries({ actor, serverId, confirmed: true, outcome: 'failed' })) {
      await logAudit(e);
    }
    return { status: 'unreachable', serverId };
  }

  if (agent.status === 'removed' || agent.status === 'alreadyRemoved') {
    // Volume weg. Credentials, Network-Namen und ServerInstance BLEIBEN erhalten.
    await prisma.serverInstance.update({ where: { id: serverId }, data: volumeRemoveSuccessUpdate() });
    const outcome = agent.status === 'removed' ? 'removed' : 'alreadyRemoved';
    for (const e of buildVolumeRemoveAuditEntries({ actor, serverId, confirmed: true, outcome })) {
      await logAudit(e);
    }
    return { status: agent.status, serverId, volumeName: agent.volumeName };
  }

  // Blockiert (Container noch da) oder Konflikt/Fehler: Status unverändert, generischer Fehlerschlüssel.
  const svcStatus: VolumeRemoveServiceStatus = agent.status === 'invalid' ? 'invalidPlan' : agent.status;
  await prisma.serverInstance.update({
    where: { id: serverId },
    data: { lastProvisioningStep: 'REMOVE_VOLUME', lastProvisioningErrorKey: volumeRemoveErrorKey(svcStatus) },
  });
  const outcome =
    agent.status === 'containerStillExists' ? 'blocked' : agent.status === 'conflict' ? 'conflict' : 'failed';
  for (const e of buildVolumeRemoveAuditEntries({ actor, serverId, confirmed: true, outcome })) {
    await logAudit(e);
  }
  return { status: svcStatus, serverId };
}
