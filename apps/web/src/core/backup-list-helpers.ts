/**
 * Reine Helfer für die read-only Backup-Liste (NDF Step 033) – unit-testbar, ohne DB/Agent.
 *
 * Nur Sichtbarkeit: kein Download, kein Restore, kein Delete, keine Docker-Aktion. Die Helfer bauen
 * Audit-Events (ohne Dateiliste/Metadaten/Secrets) und prüfen als Defense-in-Depth, dass eine
 * Agent-Antwort keine Secrets/Host-Pfade enthält, bevor sie angezeigt wird.
 */
import type { BackupListEntry, BackupListResult } from '@speakcore/types';
import type { AuditInput } from './audit';

export type BackupListServiceStatus =
  | 'ok'
  | 'notFound'
  | 'notManaged'
  | 'backupDirUnavailable'
  | 'unreachable'
  | 'error';

export interface BackupListServiceResult {
  status: BackupListServiceStatus;
  serverId?: string;
  backups?: BackupListEntry[];
}

export type BackupListAuditOutcome = 'completed' | 'failed';

/**
 * Audit-Events fürs Listen (Target = ServerInstance-ID). Bewusst **ohne** Dateiliste, ohne Anzahl,
 * ohne Metadaten-Payload, ohne Host-Pfade, ohne Secrets – nur dass gelistet wurde und das Ergebnis.
 */
export function buildBackupListAuditEntries(
  outcome: BackupListAuditOutcome,
  actor: string,
  serverId: string,
): AuditInput[] {
  const entries: AuditInput[] = [
    { action: 'backup.managedVolume.list.requested', actor, target: serverId },
  ];
  if (outcome === 'completed') {
    entries.push({ action: 'backup.managedVolume.list.completed', actor, target: serverId });
  } else {
    entries.push({
      action: 'backup.managedVolume.list.failed',
      actor,
      target: serverId,
      result: 'failure',
    });
  }
  return entries;
}

/** Erkennung absoluter Host-Pfade / Socket-Verweise in String-Werten (Heuristik, Defense-in-Depth). */
function looksLikeHostPath(value: string): boolean {
  return (
    value.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.includes('/var/lib') ||
    value.includes('docker.sock') ||
    value.includes('\\\\')
  );
}

const FORBIDDEN_KEY = /password|secret|token|credential|env/i;
const FORBIDDEN_VALUE = /password|serveradmin|TS3SERVERQUERY|encryptedPassword|bearer /i;

/**
 * Defense-in-Depth: wirft, wenn eine Backup-Listen-Antwort verbotene Schlüssel (Secrets), verdächtige
 * Werte oder absolute Host-Pfade enthält. `containsSecrets` (bekanntes Metadaten-Feld) ist erlaubt.
 */
export function assertBackupListContainsNoSecrets(result: BackupListResult): void {
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (looksLikeHostPath(node)) throw new Error(`backup list leaks a host path at ${path}`);
      if (FORBIDDEN_VALUE.test(node)) throw new Error(`backup list leaks a secret-like value at ${path}`);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (typeof node === 'object' && node !== null) {
      for (const [key, value] of Object.entries(node)) {
        if (key !== 'containsSecrets' && FORBIDDEN_KEY.test(key)) {
          throw new Error(`backup list contains forbidden key "${key}" at ${path}`);
        }
        walk(value, `${path}.${key}`);
      }
    }
  };
  walk(result, 'result');
}

/**
 * Gekürzte SHA-256-Anzeige (erste 12 Hex-Zeichen + „…"). Reine **Integritäts**information –
 * keine Verschlüsselung/Signatur. Volle Prüfsumme via Tooltip/`title`.
 */
export function shortChecksum(value: string): string {
  if (!/^[0-9a-f]{64}$/.test(value)) return '—';
  return `${value.slice(0, 12)}…`;
}

/** Menschlich lesbare Dateigröße (nur Anzeige; keine Locale-Abhängigkeit nötig). */
export function formatBackupSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return '—';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'] as const;
  let value = sizeBytes;
  let unit: string = 'B';
  for (const u of units) {
    value /= 1024;
    unit = u;
    if (value < 1024) break;
  }
  return `${value.toFixed(1)} ${unit}`;
}
