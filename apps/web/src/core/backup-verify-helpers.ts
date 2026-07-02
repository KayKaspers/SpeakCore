/**
 * Reine Helfer für das read-only Backup-Verify (NDF Step 035) – unit-testbar, ohne DB/Agent.
 *
 * Nur Verifikation: kein Download, kein Restore, kein Delete, keine Metadata-Schreibaktion,
 * keine Docker-Aktion. Audit bewusst **ohne Dateinamen** (keine Dateilisten im Audit) und ohne
 * Prüfsummenwerte/Secrets/Host-Pfade.
 */
import type { BackupVerifyStatus } from '@speakcore/types';
import type { AuditInput } from './audit';

export type BackupVerifyServiceStatus =
  | BackupVerifyStatus
  | 'notFound'
  | 'notManaged'
  | 'unreachable';

export interface BackupVerifyServiceResult {
  status: BackupVerifyServiceStatus;
  serverId?: string;
  fileName?: string;
  checksumSha256?: string;
  metadataChecksumSha256?: string;
  verifiedAt?: string;
}

/**
 * Web-seitige Vorprüfung des Dateinamens (Defense-in-Depth; der Agent validiert strikt gegen das
 * Instanz-Muster): keine Pfadbestandteile, plausibles Backup-Namensschema.
 */
export function isSafeBackupFileName(fileName: unknown): fileName is string {
  if (typeof fileName !== 'string' || fileName.length === 0 || fileName.length > 256) return false;
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return false;
  return fileName.startsWith('speakcore-backup-ts3-') && fileName.endsWith('.tar.gz');
}

export type BackupVerifyAuditOutcome = 'completed' | 'mismatch' | 'failed';

/**
 * Audit-Events (Target = ServerInstance-ID). Bewusst **ohne** Dateinamen, ohne Prüfsummenwerte,
 * ohne Metadaten – nur dass verifiziert wurde und mit welchem Ausgang. `mismatch` ist eine
 * **erfolgreich abgeschlossene** Prüfung mit negativem Ergebnis (eigenes Event + completed).
 */
export function buildBackupVerifyAuditEntries(
  outcome: BackupVerifyAuditOutcome,
  actor: string,
  serverId: string,
): AuditInput[] {
  const t = serverId;
  const entries: AuditInput[] = [
    { action: 'backup.managedVolume.verify.requested', actor, target: t },
  ];
  if (outcome === 'failed') {
    entries.push({
      action: 'backup.managedVolume.verify.failed',
      actor,
      target: t,
      result: 'failure',
    });
    return entries;
  }
  if (outcome === 'mismatch') {
    entries.push({
      action: 'backup.managedVolume.verify.mismatch',
      actor,
      target: t,
      result: 'failure',
    });
  }
  entries.push({ action: 'backup.managedVolume.verify.completed', actor, target: t });
  return entries;
}
