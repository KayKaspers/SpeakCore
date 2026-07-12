/**
 * Read-only Inspection genau **eines** managed Backups (NDF Step 045).
 *
 * **Strikt read-only:** die Archivdatei wird **nur** gelesen, um ihren SHA-256-Fingerprint zu
 * berechnen. **Kein** Docker, **kein** Prozessaufruf, **keine** Shell, **kein** Entpacken, **kein**
 * Tar-Inhaltslisting, **kein** Öffnen einzelner Archiv-Einträge, **kein** Schreiben (kein Sidecar,
 * kein Backfill), **kein** Restore/Plan/Staging/Stop/Start. Der Client liefert **nur** den managed
 * Dateinamen (kein Pfad, keine instanceId). Der Dateiname wird über die **kanonische** strikte
 * Validierung (`isValidBackupFileName`) geprüft; die `instanceId` wird dazu aus dem Namen abgeleitet.
 * Ergebnis enthält **nur** Dateiname/Größe/Zeitstempel/SHA-256 + sanitisierte Metadaten – **kein**
 * Host-Pfad, **kein** Archivinhalt, **keine** Secrets.
 *
 * **ADR-0040:** Bestandsbackups besitzen kein versioniertes Restore-Manifest ⇒ `manifest: missing`,
 * `legacy: true`, `restoreEligible: false`. Ein Legacy-Backup wird erkannt/angezeigt, aber **nie**
 * als restorefähig freigegeben.
 */
import { isValidInstanceId } from '@speakcore/shared';
import type { BackupInspectResult, Ts3BackupInspectRequest } from '@speakcore/types';
import { sanitizeBackupMetadataForDisplay } from './backup-list';
import { isValidBackupFileName } from './backup-verify';

/** Leitet die `instanceId` aus dem strikten Backup-Namen ab (fester Zeitstempel am Ende ankert). */
export function instanceIdFromBackupFileName(fileName: string): string | null {
  const m =
    /^speakcore-backup-ts3-(.+?)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.tar\.gz$/.exec(fileName);
  return m ? m[1] : null;
}

export interface InspectFileStat {
  isSymlink: boolean;
  isFile: boolean;
  sizeBytes: number;
  mtimeMs: number;
}

export interface InspectBackupOptions {
  /** `lstat` (folgt KEINEM Link): erkennt Symlink/Sonderdatei vor dem Hashen. `null` ⇒ nicht vorhanden. */
  lstatFile: (fileName: string) => Promise<InspectFileStat | null>;
  /** Defense-in-Depth: der intern aufgelöste Pfad liegt innerhalb des managed Backup-Verzeichnisses. */
  withinBoundary: (fileName: string) => boolean;
  /** SHA-256 der Datei, gestreamt (kein Voll-Buffering). `null` ⇒ Lesefehler. */
  computeSha256: (fileName: string) => Promise<string | null>;
  /** Erneutes `stat` **nach** dem Hashen (TOCTOU-Kontrolle). `null` ⇒ verschwunden. */
  statAfter: (fileName: string) => Promise<{ sizeBytes: number; mtimeMs: number } | null>;
  /** Liest die zugehörige `.metadata.json` (nur Name). `null` ⇒ fehlt/zu groß. */
  readMetadataFile: (fileName: string) => Promise<string | null>;
}

function base(fileName: string): BackupInspectResult {
  return {
    backupFileName: fileName,
    managed: false,
    regularFile: false,
    sizeBytes: null,
    modifiedAt: null,
    fingerprint: null,
    metadata: { status: 'missing', fileName: null },
    manifest: { status: 'missing', schemaVersion: null },
    legacy: true,
    compatibility: { status: 'incompatible', reasons: [] },
    restoreEligible: false,
    blockers: [],
    snapshot: null,
  };
}

/** Blocker + Kompatibilitätsgründe konsistent setzen; `restoreEligible` bleibt hier immer `false`. */
function finalize(r: BackupInspectResult): BackupInspectResult {
  const unique = [...new Set(r.blockers)];
  r.blockers = unique;
  r.compatibility = { status: 'incompatible', reasons: unique };
  r.restoreEligible = false; // Bestandsbackups sind ohne Manifest nie restorefähig (ADR-0040).
  return r;
}

export async function inspectBackup(
  request: Ts3BackupInspectRequest,
  opts: InspectBackupOptions,
): Promise<BackupInspectResult> {
  const fileName =
    typeof request === 'object' && request !== null && typeof request.backupFileName === 'string'
      ? request.backupFileName
      : '';
  const r = base(fileName);

  // 1) Kanonische strikte Namensvalidierung (keine zweite, schwächere Prüfung). Deckt `/`, `\`,
  //    `..`, absolute Pfade, falsche Endung und fremde/ungültige instanceId ab.
  const instanceId = instanceIdFromBackupFileName(fileName);
  if (!instanceId || !isValidInstanceId(instanceId) || !isValidBackupFileName(instanceId, fileName)) {
    r.blockers.push('BACKUP_NAME_INVALID');
    return finalize(r);
  }
  r.managed = true;

  // 2) Pfadgrenze (Defense-in-Depth – der Name enthält bereits keine Separatoren).
  if (!opts.withinBoundary(fileName)) {
    r.blockers.push('BACKUP_OUTSIDE_MANAGED_BOUNDARY');
    return finalize(r);
  }

  // 3) Dateityp (lstat, folgt keinem Link).
  const pre = await opts.lstatFile(fileName);
  if (!pre) {
    r.blockers.push('BACKUP_NOT_FOUND');
    return finalize(r);
  }
  if (pre.isSymlink) {
    r.blockers.push('BACKUP_LINK_REJECTED');
    return finalize(r);
  }
  if (!pre.isFile) {
    r.blockers.push('BACKUP_NOT_REGULAR_FILE');
    return finalize(r);
  }
  r.regularFile = true;
  r.sizeBytes = pre.sizeBytes;
  r.modifiedAt = new Date(pre.mtimeMs).toISOString();
  if (pre.sizeBytes === 0) r.blockers.push('BACKUP_EMPTY');

  // 4) SHA-256 streamen; danach TOCTOU-Kontrolle (Größe/mtime unverändert?).
  const sha = await opts.computeSha256(fileName);
  if (sha === null) {
    r.blockers.push('ARCHIVE_READ_FAILED');
    return finalize(r);
  }
  const post = await opts.statAfter(fileName);
  if (!post || post.sizeBytes !== pre.sizeBytes || post.mtimeMs !== pre.mtimeMs) {
    r.blockers.push('BACKUP_CHANGED_DURING_INSPECTION');
    return finalize(r); // Ergebnis verwerfen: kein Fingerprint/Snapshot.
  }
  r.fingerprint = { algorithm: 'sha256', value: sha, storedValue: null, matchesStoredValue: null };
  r.snapshot = { sizeBytes: pre.sizeBytes, modifiedAt: r.modifiedAt, sha256: sha };

  // 5) Sidecar-Metadaten defensiv prüfen (bestehende Konvention wiederverwenden).
  const metaName = fileName.replace(/\.tar\.gz$/, '.metadata.json');
  const rawText = await opts.readMetadataFile(metaName);
  if (rawText === null) {
    r.metadata = { status: 'missing', fileName: null };
    r.blockers.push('METADATA_MISSING', 'ARCHIVE_CHECKSUM_MISSING', 'INSTANCE_BINDING_UNKNOWN');
  } else {
    let sanitized = null;
    try {
      sanitized = sanitizeBackupMetadataForDisplay(JSON.parse(rawText), {
        instanceId,
        backupFileName: fileName,
      });
    } catch {
      sanitized = null;
    }
    if (!sanitized) {
      r.metadata = { status: 'invalid', fileName: metaName };
      r.blockers.push('METADATA_INVALID', 'INSTANCE_BINDING_UNKNOWN');
    } else {
      r.metadata = { status: 'valid', fileName: metaName };
      const stored = sanitized.checksum?.value ?? null;
      r.fingerprint = {
        algorithm: 'sha256',
        value: sha,
        storedValue: stored,
        matchesStoredValue: stored === null ? null : stored === sha,
      };
      if (stored === null) {
        r.blockers.push('ARCHIVE_CHECKSUM_MISSING');
      } else if (stored !== sha) {
        r.blockers.push('ARCHIVE_CHECKSUM_MISMATCH'); // Integritätsfehler
      }
    }
  }

  // 6) Manifest: in diesem Step wird KEIN Archiv geöffnet und KEIN Manifest erzeugt ⇒ heute stets
  //    fehlend (ADR-0040). Legacy-Backup: erkannt/angezeigt, aber nie restorefähig.
  r.manifest = { status: 'missing', schemaVersion: null };
  r.legacy = true;
  r.blockers.push('RESTORE_MANIFEST_MISSING');

  return finalize(r);
}
