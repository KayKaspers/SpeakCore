/**
 * Einzel-Backup-Delete für einen managed Server auslösen (NDF Step 040, ADR-0037).
 *
 * **Irreversibel.** Delegiert an den token-gated Agent-Endpunkt, der GENAU EINE strikt validierte
 * tar.gz + ihre exakt abgeleitete metadata.json entfernt (der Agent re-validiert alle Guards).
 * Web erzwingt: OWNER (Action), managed Server (auch archiviert – Backups existieren weiter),
 * Dateinamen-Vorprüfung, 3 Bestätigungen + getippt `DELETE BACKUP`, **Rate-Limit 5/h je
 * Owner+Server**. Keine Rotation, kein Bulk, keine Wildcards. **Keine DB-Schreiboperation außer
 * Audit + Rate-Limit-Treffer.**
 */
import { prisma } from './db';
import { logAudit } from './audit';
import { checkRateLimit, recordRateLimitHit, BACKUP_DELETE_RATE_LIMIT } from './rate-limit';
import { deleteManagedBackup } from '@/lib/agent-client';
import { isSafeBackupFileName } from './backup-verify-helpers';
import {
  buildBackupFileDeleteAuditEntries,
  mapDeleteConfirmations,
  type BackupDeleteFormConfirmations,
  type BackupFileDeleteServiceResult,
} from './backup-file-delete-helpers';

export * from './backup-file-delete-helpers';

export async function deleteManagedBackupForServer(
  serverId: string,
  actor: string,
  userId: string,
  fileName: string,
  confirmations: BackupDeleteFormConfirmations,
): Promise<BackupFileDeleteServiceResult> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server) return { status: 'notFound' };
  if (server.mode !== 'managed') return { status: 'notManaged', serverId };
  if (!server.instanceId) return { status: 'invalid', serverId };

  const blockWeb = async (
    status: BackupFileDeleteServiceResult['status'],
  ): Promise<BackupFileDeleteServiceResult> => {
    for (const e of buildBackupFileDeleteAuditEntries('blocked', actor, serverId)) await logAudit(e);
    return { status, serverId };
  };

  // Defense-in-Depth: grobe Web-Vorprüfung; der Agent validiert strikt gegen das Instanz-Muster.
  if (!isSafeBackupFileName(fileName)) return blockWeb('invalid');

  const pre = mapDeleteConfirmations(confirmations);
  if (pre !== 'ok') return blockWeb(pre);

  const rlKey = `backup:delete:${userId}:${serverId}`;
  if ((await checkRateLimit(rlKey, BACKUP_DELETE_RATE_LIMIT)).limited) {
    return blockWeb('rateLimited');
  }
  await recordRateLimitHit(rlKey);

  const agent = await deleteManagedBackup({
    instanceId: server.instanceId,
    fileName,
    confirmBackupDeletion: confirmations.confirmBackupDeletion,
    confirmBackupMayBeOnlyCopy: confirmations.confirmBackupMayBeOnlyCopy,
    confirmNoRestoreWithoutBackup: confirmations.confirmNoRestoreWithoutBackup,
    typedConfirmation: confirmations.typedConfirmation,
  });

  if (!agent) {
    for (const e of buildBackupFileDeleteAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { status: 'unreachable', serverId };
  }

  const outcome =
    agent.status === 'deleted'
      ? 'completed'
      : agent.status === 'alreadyRemoved'
        ? 'alreadyRemoved'
        : agent.status === 'error' || agent.status === 'metadataDeleteFailed'
          ? 'failed'
          : 'agentBlocked'; // invalid / backupDirUnavailable / …
  for (const e of buildBackupFileDeleteAuditEntries(outcome, actor, serverId)) await logAudit(e);

  return { status: agent.status, serverId, fileName: agent.fileName };
}
