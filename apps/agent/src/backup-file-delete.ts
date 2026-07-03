/**
 * Einzel-Backup-Delete (NDF Step 040): entfernt **genau eine** strikt validierte Backup-Datei und
 * ihre **exakt abgeleitete** metadata.json aus dem serverseitigen Backup-Verzeichnis.
 * **Irreversibel** – Umsetzung des Step-039-Blueprints (ADR-0037).
 *
 * **Kein** Docker, **kein** Prozessaufruf, **keine** Shell, **kein** Socket, **kein** Directory
 * Listing, **keine** Wildcards, **keine** Ordner-/rekursive Löschung, **kein** Lesen/Entpacken der
 * tar.gz. Der Dateiname wird gegen das exakte Step-032-Muster der Instanz geprüft (kein `/`, kein
 * `\`, kein `..`, keine fremden Instanzen; metadata.json ist nie primäres Ziel). Alle
 * Bestätigungen (3 Flags + getippt `DELETE BACKUP`) werden agentseitig **re-validiert**.
 * Fehlt die tar.gz bereits ⇒ `alreadyRemoved` – eine ggf. verwaiste metadata.json wird in diesem
 * Step bewusst NICHT mitgelöscht (dokumentiert). Ergebnis ohne Host-Pfade/Inhalte.
 */
import { BACKUP_DELETE_TYPED_CONFIRMATION, isValidInstanceId } from '@speakcore/shared';
import type { BackupFileDeleteResult, Ts3BackupDeleteRequest } from '@speakcore/types';
import { isValidBackupFileName } from './backup-verify';

export interface DeleteBackupFileOptions {
  /** Ist das serverseitige Backup-Verzeichnis vorhanden/lesbar? */
  dirAvailable: () => Promise<boolean>;
  /** Existiert die Datei (regulär, kein Symlink/Verzeichnis) im Backup-Verzeichnis? */
  fileExists: (fileName: string) => Promise<boolean>;
  /** Entfernt genau die benannte Datei im Backup-Verzeichnis. `false` ⇒ Fehler. */
  deleteFile: (fileName: string) => Promise<boolean>;
}

export async function deleteTs3BackupFile(
  request: Ts3BackupDeleteRequest,
  opts: DeleteBackupFileOptions,
): Promise<BackupFileDeleteResult> {
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
  // Agentseitige Re-Validierung der Step-039-Bestätigungen (keine Defaults):
  if (
    request.confirmBackupDeletion !== true ||
    request.confirmBackupMayBeOnlyCopy !== true ||
    request.confirmNoRestoreWithoutBackup !== true
  ) {
    return { status: 'invalid' };
  }
  if (request.typedConfirmation !== BACKUP_DELETE_TYPED_CONFIRMATION) {
    return { status: 'invalid' };
  }

  if (!(await opts.dirAvailable())) {
    return { status: 'backupDirUnavailable' };
  }

  try {
    if (!(await opts.fileExists(fileName))) {
      // Idempotent: bereits entfernt. Eine ggf. verwaiste metadata.json wird bewusst NICHT
      // automatisch mitgelöscht (kein Aufräumen ohne primäres Ziel – dokumentiert).
      return { status: 'alreadyRemoved', fileName };
    }

    if (!(await opts.deleteFile(fileName))) {
      return { status: 'error', fileName };
    }

    const metaName = fileName.replace(/\.tar\.gz$/, '.metadata.json');
    if (await opts.fileExists(metaName)) {
      if (!(await opts.deleteFile(metaName))) {
        // tar.gz ist bereits entfernt – ehrlicher Teilerfolg-Status.
        return { status: 'metadataDeleteFailed', fileName, metadataRemoved: false };
      }
      return { status: 'deleted', fileName, metadataRemoved: true };
    }
    return { status: 'deleted', fileName, metadataRemoved: false };
  } catch {
    return { status: 'error', fileName };
  }
}
