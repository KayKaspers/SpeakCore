/**
 * Checksum-Backfill (NDF Step 038): trägt bei einem bestehenden Backup **ohne** Prüfsumme eine
 * SHA-256 in die `.metadata.json` nach – die `.tar.gz` wird **nur gelesen (Hash), nie verändert**.
 *
 * **Kein** Docker, **kein** Prozessaufruf, **keine** Shell, **kein** Socket, **kein** Entpacken,
 * **kein** Download. Der Dateiname wird **strikt** gegen das Step-032-Muster der Instanz geprüft
 * (kein `/`, kein `\`, kein `..`, keine fremden Instanzen); die Metadaten-Datei wird intern
 * abgeleitet. **Kein Blind-Merge:** die Metadaten werden über die Step-033-Sanitisierung gelesen
 * und **normalisiert** neu geschrieben – nur bekannte Felder, eingeschleuste/unbekannte Felder
 * (inkl. Secret-artiger Keys) fallen weg. Bereits vorhandene Prüfsumme ⇒ `alreadyPresent`,
 * **keine** Schreibaktion. Ergebnis ohne Host-Pfade/Roh-Metadaten/Secrets.
 */
import type {
  BackupChecksum,
  BackupChecksumBackfillResult,
  Ts3BackupChecksumBackfillRequest,
} from '@speakcore/types';
import { isValidInstanceId } from '@speakcore/shared';
import { isValidBackupFileName } from './backup-verify';
import { sanitizeBackupMetadataForDisplay } from './backup-list';

export interface BackfillChecksumOptions {
  /** Ist das serverseitige Backup-Verzeichnis vorhanden/lesbar? */
  dirAvailable: () => Promise<boolean>;
  /** Existiert die Backup-Datei (regulär, kein Symlink/Verzeichnis)? */
  fileExists: (fileName: string) => Promise<boolean>;
  /** Liest eine `.metadata.json` im Backup-Verzeichnis (nur Name). `null` ⇒ fehlt/zu groß. */
  readMetadataFile: (fileName: string) => Promise<string | null>;
  /** SHA-256 der Datei im Backup-Verzeichnis (gestreamt, kein Entpacken). `null` ⇒ Lesefehler. */
  computeSha256: (fileName: string) => Promise<string | null>;
  /** Schreibt die normalisierte `.metadata.json` (nur Name). `false` ⇒ Fehler. */
  writeMetadataFile: (fileName: string, content: string) => Promise<boolean>;
  now?: Date;
}

export async function backfillBackupChecksum(
  request: Ts3BackupChecksumBackfillRequest,
  opts: BackfillChecksumOptions,
): Promise<BackupChecksumBackfillResult> {
  if (typeof request !== 'object' || request === null) {
    return { status: 'invalid' };
  }
  const { instanceId, fileName } = request;
  if (typeof instanceId !== 'string' || !isValidInstanceId(instanceId)) {
    return { status: 'invalid' };
  }
  if (!isValidBackupFileName(instanceId, fileName)) {
    return { status: 'invalid' };
  }
  // Explizite Bestätigung ist Pflicht (bewusste Owner-Schreibaktion, kein Vorab-Default).
  if (request.confirmChecksumBackfill !== true) {
    return { status: 'invalid' };
  }

  if (!(await opts.dirAvailable())) {
    return { status: 'backupDirUnavailable' };
  }

  try {
    if (!(await opts.fileExists(fileName))) {
      return { status: 'backupNotFound', fileName };
    }

    const metaName = fileName.replace(/\.tar\.gz$/, '.metadata.json');
    const rawText = await opts.readMetadataFile(metaName);
    if (rawText === null) {
      return { status: 'metadataMissing', fileName };
    }

    let metadata;
    try {
      metadata = sanitizeBackupMetadataForDisplay(JSON.parse(rawText), {
        instanceId,
        backupFileName: fileName,
      });
    } catch {
      metadata = null;
    }
    if (!metadata) {
      return { status: 'metadataInvalid', fileName };
    }

    if (metadata.checksum) {
      // Bereits vorhanden ⇒ NICHTS schreiben (idempotent, kein Überschreiben bestehender Werte).
      return { status: 'alreadyPresent', fileName };
    }

    const value = await opts.computeSha256(fileName);
    if (value === null) {
      return { status: 'error', fileName };
    }

    const now = opts.now ?? new Date();
    const checksum: BackupChecksum = { algorithm: 'sha256', value, createdAt: now.toISOString() };
    // Kontrolliertes Mapping: sanitisierte (nur bekannte) Felder + checksum ⇒ normalisiert schreiben.
    const updated = { ...metadata, checksum };
    const ok = await opts.writeMetadataFile(metaName, JSON.stringify(updated, null, 2));
    if (!ok) {
      return { status: 'error', fileName };
    }

    return { status: 'updated', fileName };
  } catch {
    return { status: 'error', fileName };
  }
}
