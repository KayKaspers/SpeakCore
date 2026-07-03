/**
 * Reine Helfer für den Web-proxied Backup-Download (NDF Step 037) – unit-testbar, ohne DB/Agent.
 *
 * Setzt das Step-036-Blueprint um: Bestätigungen (sensible Daten + Aufbewahrung + getippt
 * `DOWNLOAD BACKUP`, keine Defaults) und Audit-Events **ohne Dateinamen/Prüfsummen/Host-Pfade**.
 * `started` ist der letzte zuverlässig auditierbare Punkt – ein `completed` wird bewusst NICHT
 * geloggt, weil das Ende des durchgereichten Streams im Web-Prozess nicht sicher erfassbar ist.
 */
import { BACKUP_DOWNLOAD_TYPED_CONFIRMATION } from '@speakcore/shared';
import type { AuditInput } from './audit';

export interface BackupDownloadFormConfirmations {
  confirmBackupContainsSensitiveData?: boolean;
  confirmSecureStorageResponsibility?: boolean;
  typedConfirmation?: string;
}

export type BackupDownloadServiceStatus =
  | 'ok'
  | 'notFound'
  | 'notManaged'
  | 'invalid'
  | 'sensitiveDataRequired'
  | 'storageRequired'
  | 'typedMismatch'
  | 'rateLimited'
  | 'mismatch'
  | 'checksumMissing'
  | 'metadataMissing'
  | 'metadataInvalid'
  | 'backupNotFound'
  | 'backupDirUnavailable'
  | 'unreachable'
  | 'error';

/**
 * Bestätigungs-Vorprüfung (keine Defaults, getippte Bestätigung ist Pflicht und muss exakt
 * `DOWNLOAD BACKUP` sein). Liefert `ok` oder den ersten fehlenden Grund.
 */
export function mapDownloadConfirmations(
  confirmations: BackupDownloadFormConfirmations,
): 'ok' | 'sensitiveDataRequired' | 'storageRequired' | 'typedMismatch' {
  if (confirmations.confirmBackupContainsSensitiveData !== true) return 'sensitiveDataRequired';
  if (confirmations.confirmSecureStorageResponsibility !== true) return 'storageRequired';
  if (confirmations.typedConfirmation !== BACKUP_DOWNLOAD_TYPED_CONFIRMATION) return 'typedMismatch';
  return 'ok';
}

export type BackupDownloadAuditOutcome = 'blocked' | 'verifyBlocked' | 'started' | 'failed';

/**
 * Audit-Events (Target = ServerInstance-ID). Bewusst **ohne Dateinamen** (keine Dateilisten im
 * Audit), ohne Prüfsummen, ohne Inhalt, ohne Host-Pfade.
 * - `blocked`: vor den Bestätigungen/Guards gescheitert (requested + blocked)
 * - `verifyBlocked`: Bestätigungen ok, aber Verify nicht `valid` (requested + confirmed + blocked)
 * - `started`: Stream begonnen – letzter zuverlässiger Audit-Punkt (requested + confirmed + started)
 * - `failed`: nach Bestätigung fehlgeschlagen (requested + confirmed + failed)
 */
export function buildBackupDownloadAuditEntries(
  outcome: BackupDownloadAuditOutcome,
  actor: string,
  serverId: string,
): AuditInput[] {
  const t = serverId;
  const entries: AuditInput[] = [
    { action: 'backup.managedVolume.download.requested', actor, target: t },
  ];

  if (outcome === 'blocked') {
    entries.push({
      action: 'backup.managedVolume.download.blocked',
      actor,
      target: t,
      result: 'failure',
    });
    return entries;
  }

  entries.push({ action: 'backup.managedVolume.download.confirmed', actor, target: t });

  if (outcome === 'verifyBlocked') {
    entries.push({
      action: 'backup.managedVolume.download.blocked',
      actor,
      target: t,
      result: 'failure',
    });
    return entries;
  }

  if (outcome === 'started') {
    entries.push({ action: 'backup.managedVolume.download.started', actor, target: t });
  } else {
    entries.push({
      action: 'backup.managedVolume.download.failed',
      actor,
      target: t,
      result: 'failure',
    });
  }
  return entries;
}
