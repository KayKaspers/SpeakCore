/**
 * Managed Volume-Backup auslösen (NDF Step 032). **Backup-Dateien sind potenziell sensibel.**
 *
 * Delegiert an den Agent, der das Volume **read-only** in ein **serverseitiges** Verzeichnis sichert –
 * **kein** Pfad/Image/Arg vom Client, **kein** Restore/Import, **kein Log-Lesen**. Web erzwingt: managed,
 * nicht archiviert, `RESOURCES_PREPARED`, Volume nicht `removed`, und die Bestätigungen (Step-030-Guard).
 * **Keine DB-Schreiboperation außer dem Backup-Audit.** OWNER-only erzwingt die Server Action.
 */
import { prisma } from './db';
import { logAudit } from './audit';
import { backupManagedVolume } from '@/lib/agent-client';
import {
  buildVolumeBackupAuditEntries,
  mapBackupConfirmationGuard,
  type BackupConfirmations,
  type VolumeBackupServiceResult,
  type VolumeBackupServiceStatus,
} from './volume-backup-helpers';

export * from './volume-backup-helpers';

export async function backupManagedVolumeForServer(
  serverId: string,
  actor: string,
  confirmations: BackupConfirmations,
): Promise<VolumeBackupServiceResult> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server) return { status: 'notFound' };
  if (server.mode !== 'managed') return { status: 'notManaged', serverId };

  const blockWeb = async (status: VolumeBackupServiceStatus): Promise<VolumeBackupServiceResult> => {
    for (const e of buildVolumeBackupAuditEntries('blocked', actor, serverId)) await logAudit(e);
    return { status, serverId };
  };

  if (server.archivedAt) return blockWeb('archived');
  if (server.provisioningStatus !== 'RESOURCES_PREPARED') return blockWeb('invalidState');
  if (server.managedVolumeState === 'removed') return blockWeb('volumeNotFound');
  if (!server.instanceId) return blockWeb('invalidState');

  const pre = mapBackupConfirmationGuard(confirmations);
  if (pre !== 'ok') return blockWeb(pre);

  const agent = await backupManagedVolume({
    instanceId: server.instanceId,
    serverDisplayName: server.name,
    confirmBackupMayContainSensitiveData: confirmations.confirmBackupMayContainSensitiveData,
    confirmBackupStorageResponsibility: confirmations.confirmBackupStorageResponsibility,
    confirmContainerShouldBeStopped: confirmations.confirmContainerShouldBeStopped,
    typedConfirmation: confirmations.typedConfirmation,
  });

  if (!agent) {
    for (const e of buildVolumeBackupAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { status: 'unreachable', serverId };
  }

  if (agent.status === 'created') {
    for (const e of buildVolumeBackupAuditEntries('created', actor, serverId)) await logAudit(e);
    return { status: 'created', serverId, backupFileName: agent.backupFileName };
  }

  // Agent-seitig blockiert vs. Ausführungsfehler.
  const agentBlocked = new Set([
    'blocked',
    'containerStillExists',
    'volumeNotFound',
    'volumeNotManaged',
    'backupDirUnavailable',
    'imageUnavailable',
  ]);
  const outcome = agentBlocked.has(agent.status) ? 'agentBlocked' : 'failed';
  for (const e of buildVolumeBackupAuditEntries(outcome, actor, serverId)) await logAudit(e);

  // 'blocked'/'invalid' vom Agent (Defense-in-Depth; Web hat Bestätigungen bereits geprüft) ⇒ invalidState.
  const svcStatus: VolumeBackupServiceStatus =
    agent.status === 'invalid' || agent.status === 'blocked' ? 'invalidState' : agent.status;
  return { status: svcStatus, serverId };
}
