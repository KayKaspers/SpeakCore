/**
 * Web-proxied Backup-Download (NDF Step 037) – Umsetzung des Step-036-Blueprints (ADR-0035).
 *
 * Ablauf: OWNER-only (Route) → managed Server → strikte Dateinamen-Vorprüfung → Bestätigungen
 * (sensible Daten + Aufbewahrung + getippt `DOWNLOAD BACKUP`) → **Rate-Limit** (5/h je
 * Owner+Server) → **Verify direkt vor Download** (Option A: SHA-256 wird serverseitig erneut
 * geprüft, nur `valid` streamt) → serverseitiger Agent-Stream wird OHNE Komplett-Einlesen
 * durchgereicht. **Nie Browser→Agent**; Agent-URL/Token bleiben serverseitig. Kein Restore,
 * kein Delete, kein Import. **Keine DB-Schreiboperation außer Audit + Rate-Limit-Treffer.**
 */
import { prisma } from './db';
import { logAudit } from './audit';
import { checkRateLimit, recordRateLimitHit, BACKUP_DOWNLOAD_RATE_LIMIT } from './rate-limit';
import {
  downloadManagedVolumeBackup,
  verifyManagedVolumeBackup,
  type AgentBackupDownloadStream,
} from '@/lib/agent-client';
import { isSafeBackupFileName } from './backup-verify-helpers';
import {
  buildBackupDownloadAuditEntries,
  mapDownloadConfirmations,
  type BackupDownloadFormConfirmations,
  type BackupDownloadServiceStatus,
} from './backup-download-helpers';

export * from './backup-download-helpers';

export type BackupDownloadServiceResult =
  | { kind: 'stream'; download: AgentBackupDownloadStream }
  | { kind: 'blocked'; status: BackupDownloadServiceStatus };

export async function downloadManagedVolumeBackupForServer(
  serverId: string,
  actor: string,
  userId: string,
  fileName: string,
  confirmations: BackupDownloadFormConfirmations,
): Promise<BackupDownloadServiceResult> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server) return { kind: 'blocked', status: 'notFound' };
  if (server.mode !== 'managed') return { kind: 'blocked', status: 'notManaged' };
  if (!server.instanceId) return { kind: 'blocked', status: 'invalid' };

  const blockWeb = async (status: BackupDownloadServiceStatus): Promise<BackupDownloadServiceResult> => {
    for (const e of buildBackupDownloadAuditEntries('blocked', actor, serverId)) await logAudit(e);
    return { kind: 'blocked', status };
  };

  // Defense-in-Depth: grobe Web-Vorprüfung; der Agent validiert strikt gegen das Instanz-Muster.
  if (!isSafeBackupFileName(fileName)) return blockWeb('invalid');

  const pre = mapDownloadConfirmations(confirmations);
  if (pre !== 'ok') return blockWeb(pre);

  // Rate-Limit (5/h je Owner+Server, Step-036-Policy). Bei Limit: kein Verify, kein Stream.
  const rlKey = `backup:download:${userId}:${serverId}`;
  if ((await checkRateLimit(rlKey, BACKUP_DOWNLOAD_RATE_LIMIT)).limited) {
    return blockWeb('rateLimited');
  }
  await recordRateLimitHit(rlKey);

  // Verify-vor-Download (harte Regel, Option A): SHA-256 wird JETZT erneut geprüft.
  const verify = await verifyManagedVolumeBackup({ instanceId: server.instanceId, fileName });
  if (!verify) {
    for (const e of buildBackupDownloadAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { kind: 'blocked', status: 'unreachable' };
  }
  if (verify.status !== 'valid') {
    for (const e of buildBackupDownloadAuditEntries('verifyBlocked', actor, serverId)) await logAudit(e);
    const status: BackupDownloadServiceStatus =
      verify.status === 'mismatch' ||
      verify.status === 'checksumMissing' ||
      verify.status === 'metadataMissing' ||
      verify.status === 'metadataInvalid' ||
      verify.status === 'backupNotFound' ||
      verify.status === 'backupDirUnavailable'
        ? verify.status
        : 'error';
    return { kind: 'blocked', status };
  }

  // Nur nach valid: Agent-Stream anfordern und durchreichen.
  const download = await downloadManagedVolumeBackup({ instanceId: server.instanceId, fileName });
  if (!download) {
    for (const e of buildBackupDownloadAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { kind: 'blocked', status: 'error' };
  }

  // `started` ist der letzte zuverlässige Audit-Punkt (Stream-Ende ist im Proxy nicht sicher erfassbar).
  for (const e of buildBackupDownloadAuditEntries('started', actor, serverId)) await logAudit(e);
  return { kind: 'stream', download };
}
