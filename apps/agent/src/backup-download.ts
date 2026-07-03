/**
 * Kontrollierter Backup-Download (NDF Step 037): löst **genau eine** strikt validierte Backup-Datei
 * aus dem serverseitigen Backup-Verzeichnis zum Streamen auf – **read-only**.
 *
 * **Kein** Docker, **kein** Prozessaufruf, **keine** Shell, **kein** Socket, **kein** Entpacken,
 * **keine** Schreibaktion, **kein** Directory Listing (der Dateiname kommt aus dem Request und wird
 * gegen das exakte Step-032-Muster geprüft – nur `.tar.gz`, nie `.metadata.json`, kein `/`, kein
 * `\`, kein `..`, keine fremden Instanzen). Dieses Modul öffnet selbst **keine** Datei – es
 * validiert und liefert Größe/Header-Daten; das eigentliche Streaming macht die Route über einen
 * injizierten Read-Stream-Provider. Ergebnis enthält **nur** Dateiname/Größe, keine Host-Pfade.
 */
import { isValidInstanceId } from '@speakcore/shared';
import type { Ts3BackupDownloadRequest } from '@speakcore/types';
import { isValidBackupFileName } from './backup-verify';

export type BackupDownloadResolveStatus = 'ok' | 'invalid' | 'backupNotFound' | 'backupDirUnavailable';

export interface BackupDownloadResolveResult {
  status: BackupDownloadResolveStatus;
  fileName?: string;
  sizeBytes?: number;
  /** Fester Download-Content-Type (gzip-Archiv). */
  contentType?: 'application/gzip';
}

export interface ResolveBackupDownloadOptions {
  /** Ist das serverseitige Backup-Verzeichnis vorhanden/lesbar? */
  dirAvailable: () => Promise<boolean>;
  /** Stat einer regulären Datei im Backup-Verzeichnis (nur Name). `null` ⇒ fehlt/kein File. */
  statFile: (fileName: string) => Promise<{ sizeBytes: number } | null>;
}

export async function resolveBackupDownload(
  request: Ts3BackupDownloadRequest,
  opts: ResolveBackupDownloadOptions,
): Promise<BackupDownloadResolveResult> {
  if (typeof request !== 'object' || request === null) {
    return { status: 'invalid' };
  }
  const { instanceId, fileName } = request;
  if (typeof instanceId !== 'string' || !isValidInstanceId(instanceId)) {
    return { status: 'invalid' };
  }
  // Striktes Muster: nur die tar.gz der eigenen Instanz – metadata.json u. a. sind nie streambar.
  if (!isValidBackupFileName(instanceId, fileName)) {
    return { status: 'invalid' };
  }

  if (!(await opts.dirAvailable())) {
    return { status: 'backupDirUnavailable' };
  }

  const stat = await opts.statFile(fileName);
  if (!stat) {
    return { status: 'backupNotFound', fileName };
  }

  return { status: 'ok', fileName, sizeBytes: stat.sizeBytes, contentType: 'application/gzip' };
}
