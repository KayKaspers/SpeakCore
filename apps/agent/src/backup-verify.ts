/**
 * Read-only Backup-Verify (NDF Step 035): SHA-256 einer vorhandenen Backup-Datei **neu berechnen**
 * und mit der `.metadata.json` vergleichen – **es wird NICHTS verändert**.
 *
 * **Kein** Docker, **kein** Prozessaufruf, **keine** Shell, **kein** Socket, **kein** Entpacken,
 * **keine** Metadata-Schreibaktion, **kein** Download (Dateiinhalt verlässt den Agent nie – nur
 * Status + Prüfsummenwerte). Der Client liefert `instanceId` + Dateiname; der Dateiname wird
 * **strikt** gegen das Step-032-Muster der Instanz validiert (kein `/`, kein `\`, kein `..`,
 * keine fremden Instanzen). Alle Dateioperationen laufen ausschließlich über das serverseitige
 * Backup-Verzeichnis (`AGENT_BACKUP_DIR`, injizierte Ops nur mit Dateinamen – keine Host-Pfade).
 */
import { isValidInstanceId } from '@speakcore/shared';
import type { BackupVerifyResult, Ts3BackupVerifyRequest } from '@speakcore/types';
import { backupFileRegex, sanitizeBackupMetadataForDisplay } from './backup-list';

export interface VerifyBackupOptions {
  /** Ist das serverseitige Backup-Verzeichnis vorhanden/lesbar? */
  dirAvailable: () => Promise<boolean>;
  /** Existiert die Datei (regulär, kein Symlink/Verzeichnis) im Backup-Verzeichnis? */
  fileExists: (fileName: string) => Promise<boolean>;
  /** Liest eine `.metadata.json` im Backup-Verzeichnis (nur Name). `null` ⇒ fehlt/zu groß. */
  readMetadataFile: (fileName: string) => Promise<string | null>;
  /** SHA-256 der Datei im Backup-Verzeichnis (gestreamt, kein Entpacken). `null` ⇒ Lesefehler. */
  computeSha256: (fileName: string) => Promise<string | null>;
  now?: Date;
}

/** Strikte Dateinamen-Prüfung: exaktes Muster der Instanz, keinerlei Pfadbestandteile. */
export function isValidBackupFileName(instanceId: string, fileName: unknown): fileName is string {
  if (typeof fileName !== 'string') return false;
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return false;
  return backupFileRegex(instanceId).test(fileName);
}

export async function verifyTs3VolumeBackup(
  request: Ts3BackupVerifyRequest,
  opts: VerifyBackupOptions,
): Promise<BackupVerifyResult> {
  if (typeof request !== 'object' || request === null) {
    return { status: 'invalid', errors: [{ code: 'inputInvalid' }] };
  }
  const { instanceId, fileName } = request;
  if (typeof instanceId !== 'string' || !isValidInstanceId(instanceId)) {
    return { status: 'invalid', errors: [{ code: 'instanceIdInvalid' }] };
  }
  if (!isValidBackupFileName(instanceId, fileName)) {
    return { status: 'invalid', errors: [{ code: 'fileNameInvalid' }] };
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

    if (!metadata.checksum) {
      // Step-032-Bestandsbackups ohne Prüfsumme: bewusst NUR anzeigen, kein Nachrüsten (read-only).
      return { status: 'checksumMissing', fileName };
    }

    const computed = await opts.computeSha256(fileName);
    if (computed === null) {
      return { status: 'error', fileName };
    }

    const now = opts.now ?? new Date();
    const base = {
      fileName,
      algorithm: 'sha256' as const,
      checksumSha256: computed,
      metadataChecksumSha256: metadata.checksum.value,
      verifiedAt: now.toISOString(),
    };
    return computed === metadata.checksum.value
      ? { status: 'valid', ...base }
      : { status: 'mismatch', ...base };
  } catch {
    return { status: 'error', fileName };
  }
}
