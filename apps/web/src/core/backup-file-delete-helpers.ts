/**
 * Reine Helfer für das Einzel-Backup-Delete (NDF Step 040) – unit-testbar, ohne DB/Agent.
 *
 * Setzt das Step-039-Blueprint um: 3 Pflichtbestätigungen + getippt `DELETE BACKUP` (keine
 * Defaults). Audit bewusst **ohne Dateinamen** (bestehende Linie), ohne Prüfsummen/Inhalte/
 * Host-Pfade. `alreadyRemoved` ist ein idempotenter Erfolg (completed ohne started).
 */
import { BACKUP_DELETE_TYPED_CONFIRMATION } from '@speakcore/shared';
import type { BackupFileDeleteStatus } from '@speakcore/types';
import type { AuditInput } from './audit';

export interface BackupDeleteFormConfirmations {
  confirmBackupDeletion?: boolean;
  confirmBackupMayBeOnlyCopy?: boolean;
  confirmNoRestoreWithoutBackup?: boolean;
  typedConfirmation?: string;
}

export type BackupFileDeleteServiceStatus =
  | BackupFileDeleteStatus
  | 'notFound'
  | 'notManaged'
  | 'deletionRequired'
  | 'onlyCopyRequired'
  | 'restoreWarnRequired'
  | 'typedMismatch'
  | 'rateLimited'
  | 'unreachable';

export interface BackupFileDeleteServiceResult {
  status: BackupFileDeleteServiceStatus;
  serverId?: string;
  fileName?: string;
}

/**
 * Bestätigungs-Vorprüfung (keine Defaults; getippte Bestätigung ist Pflicht und muss exakt
 * `DELETE BACKUP` sein). Liefert `ok` oder den ersten fehlenden Grund.
 */
export function mapDeleteConfirmations(
  confirmations: BackupDeleteFormConfirmations,
): 'ok' | 'deletionRequired' | 'onlyCopyRequired' | 'restoreWarnRequired' | 'typedMismatch' {
  if (confirmations.confirmBackupDeletion !== true) return 'deletionRequired';
  if (confirmations.confirmBackupMayBeOnlyCopy !== true) return 'onlyCopyRequired';
  if (confirmations.confirmNoRestoreWithoutBackup !== true) return 'restoreWarnRequired';
  if (confirmations.typedConfirmation !== BACKUP_DELETE_TYPED_CONFIRMATION) return 'typedMismatch';
  return 'ok';
}

export type BackupFileDeleteAuditOutcome =
  | 'blocked'
  | 'agentBlocked'
  | 'completed'
  | 'alreadyRemoved'
  | 'failed';

/**
 * Audit-Events (Target = ServerInstance-ID), **ohne Dateinamen**:
 * - `blocked`: Web-Vorprüfung gescheitert (requested + blocked)
 * - `agentBlocked`: Bestätigungen ok, Agent blockiert (requested + confirmed + blocked)
 * - `completed`: gelöscht (requested + confirmed + started + completed)
 * - `alreadyRemoved`: idempotent, nichts zu löschen (requested + confirmed + completed)
 * - `failed`: Löschung fehlgeschlagen (requested + confirmed + started + failed)
 */
export function buildBackupFileDeleteAuditEntries(
  outcome: BackupFileDeleteAuditOutcome,
  actor: string,
  serverId: string,
): AuditInput[] {
  const t = serverId;
  const entries: AuditInput[] = [
    { action: 'backup.managedVolume.delete.requested', actor, target: t },
  ];

  if (outcome === 'blocked') {
    entries.push({
      action: 'backup.managedVolume.delete.blocked',
      actor,
      target: t,
      result: 'failure',
    });
    return entries;
  }

  entries.push({ action: 'backup.managedVolume.delete.confirmed', actor, target: t });

  if (outcome === 'agentBlocked') {
    entries.push({
      action: 'backup.managedVolume.delete.blocked',
      actor,
      target: t,
      result: 'failure',
    });
    return entries;
  }

  if (outcome === 'alreadyRemoved') {
    entries.push({ action: 'backup.managedVolume.delete.completed', actor, target: t });
    return entries;
  }

  entries.push({ action: 'backup.managedVolume.delete.started', actor, target: t });
  if (outcome === 'completed') {
    entries.push({ action: 'backup.managedVolume.delete.completed', actor, target: t });
  } else {
    entries.push({
      action: 'backup.managedVolume.delete.failed',
      actor,
      target: t,
      result: 'failure',
    });
  }
  return entries;
}
