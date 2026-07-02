/**
 * Read-only Auflisten vorhandener Volume-Backups (NDF Step 033) – **reine Sichtbarkeit**.
 *
 * Liest ausschließlich Verzeichniseinträge + `.metadata.json` aus dem serverseitigen Backup-Verzeichnis
 * (`AGENT_BACKUP_DIR`): **kein** Docker, **keine** Shell, **kein** Prozessaufruf, **kein** Download/Restore/
 * Delete, **kein** Lesen von `tar.gz`-Inhalten, **kein** Entpacken. Der Client liefert **nur** die
 * `instanceId` – kein Pfad, kein Muster (keine Pfad-Traversal-Möglichkeit; Dateinamen werden gegen ein
 * **striktes** Muster geprüft, Subdirectories/Symlinks werden nie gelistet). Ergebnis enthält **nur
 * Dateinamen** (keine Host-Pfade), Größe/Zeitstempel und **sanitisierte** Metadaten ohne Secrets.
 */
import { isValidInstanceId } from '@speakcore/shared';
import type {
  BackupChecksum,
  BackupListEntry,
  BackupListResult,
  BackupMetadata,
  BackupMetadataStatus,
  Ts3BackupListRequest,
} from '@speakcore/types';

/** Maximale Größe einer `.metadata.json`, die gelesen wird (Schutz vor Riesen-Dateien). */
export const METADATA_MAX_BYTES = 64 * 1024;

/** Strikter Zeitstempel wie ihn Step 032 erzeugt (ISO, `:`/`.` → `-`). */
const TIMESTAMP_PATTERN = '\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z';

/** Exaktes Dateinamensmuster für Backups der gegebenen Instanz – nichts anderes wird gelistet. */
export function backupFileRegex(instanceId: string): RegExp {
  return new RegExp(`^speakcore-backup-ts3-${instanceId}-(${TIMESTAMP_PATTERN})\\.tar\\.gz$`);
}

/** Verzeichniseintrag, wie ihn die injizierte `listDir`-Operation liefert (Symlinks ⇒ `isFile: false`). */
export interface BackupDirEntry {
  name: string;
  isFile: boolean;
}

export interface BackupFileStat {
  sizeBytes: number;
  createdAt: string;
  modifiedAt: string;
}

export interface ListBackupsOptions {
  /** Listet das serverseitige Backup-Verzeichnis (nicht rekursiv). `null` ⇒ nicht verfügbar. */
  listDir: () => Promise<BackupDirEntry[] | null>;
  /** Stat einer Datei **im** Backup-Verzeichnis (nur Name, kein Pfad). `null` ⇒ Eintrag überspringen. */
  statFile: (fileName: string) => Promise<BackupFileStat | null>;
  /** Liest eine `.metadata.json` **im** Backup-Verzeichnis (nur Name). `null` ⇒ fehlt/zu groß. */
  readMetadataFile: (fileName: string) => Promise<string | null>;
}

/** Gültige SHA-256-Checksum-Struktur (Step 034): festes Schema, 64 Hex-Zeichen, kein Pfad/Secret. */
function sanitizeChecksum(raw: unknown): BackupChecksum | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;
  if (c.algorithm !== 'sha256') return null;
  if (typeof c.value !== 'string' || !/^[0-9a-f]{64}$/.test(c.value)) return null;
  if (typeof c.createdAt !== 'string') return null;
  return { algorithm: 'sha256', value: c.value, createdAt: c.createdAt };
}

/**
 * Sanitisiert rohe Metadaten für die Anzeige: **nur bekannte Felder**, korrekte Typen, `instanceId`
 * und `backupFileName` müssen zur gelisteten Datei passen. Unbekannte Felder werden **verworfen**
 * (nie durchgereicht), ungültige Metadaten ⇒ `null` (Anzeige als `invalid`). Ein vorhandenes,
 * aber ungültiges `checksum`-Feld macht die Metadaten ebenfalls `invalid` (fehlend ist erlaubt –
 * ältere Backups aus Step 032 haben keine Prüfsumme).
 */
export function sanitizeBackupMetadataForDisplay(
  raw: unknown,
  expected: { instanceId: string; backupFileName: string },
): BackupMetadata | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.backupVersion !== 'number') return null;
  if (r.product !== 'SpeakCore') return null;
  if (r.kind !== 'managed-ts3-volume-backup') return null;
  if (typeof r.createdAt !== 'string') return null;
  if (r.instanceId !== expected.instanceId) return null;
  if (r.backupFileName !== expected.backupFileName) return null;
  if (typeof r.serverDisplayName !== 'string') return null;
  if (typeof r.volumeName !== 'string') return null;
  if (r.containsSecrets !== 'unknown') return null;
  if (typeof r.createdBy !== 'string') return null;
  if (!Array.isArray(r.notes) || !r.notes.every((n) => typeof n === 'string')) return null;

  let checksum: BackupChecksum | undefined;
  if (r.checksum !== undefined) {
    const sanitized = sanitizeChecksum(r.checksum);
    if (!sanitized) return null; // vorhanden, aber ungültig ⇒ Metadaten insgesamt invalid
    checksum = sanitized;
  }

  // Explizites Feld-für-Feld-Mapping – KEIN Spread des Roh-Objekts (unbekannte Keys fallen weg).
  return {
    backupVersion: r.backupVersion,
    product: 'SpeakCore',
    kind: 'managed-ts3-volume-backup',
    createdAt: r.createdAt,
    instanceId: expected.instanceId,
    serverDisplayName: r.serverDisplayName,
    volumeName: r.volumeName,
    backupFileName: expected.backupFileName,
    ...(checksum ? { checksum } : {}),
    containsSecrets: 'unknown',
    createdBy: r.createdBy,
    notes: r.notes as string[],
  };
}

export async function listTs3VolumeBackups(
  request: Ts3BackupListRequest,
  opts: ListBackupsOptions,
): Promise<BackupListResult> {
  if (typeof request !== 'object' || request === null) {
    return { status: 'invalid', errors: [{ code: 'inputInvalid' }] };
  }
  const { instanceId } = request;
  if (typeof instanceId !== 'string' || !isValidInstanceId(instanceId)) {
    return { status: 'invalid', errors: [{ code: 'instanceIdInvalid' }] };
  }

  const entries = await opts.listDir();
  if (entries === null) {
    return { status: 'backupDirUnavailable' };
  }

  try {
    const pattern = backupFileRegex(instanceId);
    const backups: BackupListEntry[] = [];

    for (const entry of entries) {
      // Nur reguläre Dateien mit exakt passendem Muster – keine Subdirs, keine Symlinks,
      // keine fremden Instanzen, keine sonstigen Dateien.
      if (!entry.isFile || !pattern.test(entry.name)) continue;

      const stat = await opts.statFile(entry.name);
      if (!stat) continue;

      const metaName = entry.name.replace(/\.tar\.gz$/, '.metadata.json');
      let metadataStatus: BackupMetadataStatus = 'missing';
      let metadata: BackupMetadata | undefined;
      const rawText = await opts.readMetadataFile(metaName);
      if (rawText !== null) {
        try {
          const sanitized = sanitizeBackupMetadataForDisplay(JSON.parse(rawText), {
            instanceId,
            backupFileName: entry.name,
          });
          if (sanitized) {
            metadataStatus = 'present';
            metadata = sanitized;
          } else {
            metadataStatus = 'invalid';
          }
        } catch {
          metadataStatus = 'invalid';
        }
      }

      backups.push({
        fileName: entry.name,
        sizeBytes: stat.sizeBytes,
        createdAt: stat.createdAt,
        modifiedAt: stat.modifiedAt,
        metadataStatus,
        ...(metadata ? { metadata } : {}),
      });
    }

    // Neueste zuerst (Zeitstempel steckt im Dateinamen).
    backups.sort((a, b) => b.fileName.localeCompare(a.fileName));
    return { status: 'ok', backups };
  } catch {
    return { status: 'error' };
  }
}
