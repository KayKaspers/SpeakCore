/**
 * Echtes Backup eines managed TS3-Datenvolumes (NDF Step 032). **Backup-Dateien sind potenziell sensibel.**
 *
 * Sichert die Volumequelle **read-only** über einen kurzlebigen, gelabelten Hilfscontainer:
 *   `docker run --rm … -v <vol>:/data:ro -v <backupDir>:/backup <image> tar -czf /backup/<file> -C /data .`
 * Ausschließlich **statische** `execFile`-Argumente, **keine Shell**, **kein** freier Pfad/Image/Arg vom
 * Client. STRIKT: keine Remove-/Inspect-/Log-/Exec-Docker-Befehle, kein Socket, kein Restore/Import.
 * **Konservativ:** blockiert, wenn **irgendein** managed Container dieser `instanceId` existiert.
 * Backup-Ziel (`backupDir`) und Image sind **serverseitig** festgelegt; der Volume-Name wird aus der
 * `instanceId` abgeleitet. Ergebnis enthält **nur** den Dateinamen (kein Host-Pfad), keine Secrets/Roh-Ausgabe.
 */
import {
  buildBackupMetadata,
  canBackupManagedVolume,
  containerName,
  defaultVolumeName,
  isValidInstanceId,
} from '@speakcore/shared';
import type { Ts3VolumeBackupRequest, VolumeBackupResult } from '@speakcore/types';
import type { DockerExec } from './docker-cli';

/** Festes, allowlisted Backup-Image (kein freies Image vom Client). */
export const DEFAULT_BACKUP_IMAGE = 'alpine:3.20';

const BACKUP_TIMEOUT_MS = 300_000; // tar eines Volumes kann dauern.

function exactNames(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter((l) => l.length > 0);
}

/** Dateisystem-sicherer Zeitstempel (nur aus der Serveruhr, kein Client-Input). */
function safeTimestamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, '-');
}

export interface BackupVolumeOptions {
  writeEnabled: boolean;
  exec: DockerExec;
  /** Serverseitig festgelegtes Backup-Verzeichnis (AGENT_BACKUP_DIR). */
  backupDir: string;
  /** Serverseitig festgelegtes, allowlisted Image. */
  backupImage: string;
  /** Legt das Backup-Verzeichnis an/prüft es. `false` ⇒ nicht verfügbar. */
  ensureDir: (dir: string) => Promise<boolean>;
  /** Schreibt die Metadaten-Datei. `false` ⇒ Fehler. */
  writeMetadata: (fullPath: string, content: string) => Promise<boolean>;
  now?: Date;
}

export async function backupTs3Volume(
  request: Ts3VolumeBackupRequest,
  opts: BackupVolumeOptions,
): Promise<VolumeBackupResult> {
  if (!opts.writeEnabled) {
    return { status: 'writeDisabled', audit: [] };
  }

  if (typeof request !== 'object' || request === null) {
    return { status: 'invalid', errors: [{ code: 'inputInvalid' }], audit: [] };
  }
  const { instanceId } = request;
  if (typeof instanceId !== 'string' || !isValidInstanceId(instanceId)) {
    return { status: 'invalid', errors: [{ code: 'instanceIdInvalid' }], audit: [] };
  }

  const volume = defaultVolumeName(instanceId);
  const container = containerName(instanceId);

  // 3) Backup-Verzeichnis serverseitig verfügbar?
  if (!(await opts.ensureDir(opts.backupDir))) {
    return { status: 'backupDirUnavailable', audit: [] };
  }

  // 1) Availability-Probe (managed gefiltert).
  const probe = await opts.exec([
    'container',
    'ls',
    '--all',
    '--filter',
    'label=speakcore.managed=true',
    '--format',
    '{{.Names}}',
  ]);
  if (!probe.ok) {
    return { status: 'unavailable', audit: [] };
  }

  // 4) Existiert noch ein managed Container dieser instanceId? → konservativ blockieren.
  const containers = await opts.exec([
    'container',
    'ls',
    '--all',
    '--filter',
    'label=speakcore.managed=true',
    '--filter',
    `label=speakcore.instanceId=${instanceId}`,
    '--format',
    '{{.Names}}',
  ]);
  if (containers.ok && exactNames(containers.stdout).includes(container)) {
    return {
      status: 'containerStillExists',
      audit: [{ action: 'backup.managedVolume.blocked', noteKey: 'provisioning.audit.backup.containerStillExists' }],
    };
  }

  // 5)/6) Managed Volume vorhanden?
  const managedVol = await opts.exec([
    'volume',
    'ls',
    '--filter',
    'label=speakcore.managed=true',
    '--filter',
    `label=speakcore.instanceId=${instanceId}`,
    '--format',
    '{{.Name}}',
  ]);
  const isManaged = managedVol.ok && exactNames(managedVol.stdout).includes(volume);
  if (!isManaged) {
    const any = await opts.exec(['volume', 'ls', '--filter', `name=${volume}`, '--format', '{{.Name}}']);
    if (any.ok && exactNames(any.stdout).includes(volume)) {
      return {
        status: 'volumeNotManaged',
        audit: [{ action: 'backup.managedVolume.blocked', noteKey: 'provisioning.audit.backup.volumeNotManaged' }],
      };
    }
    return {
      status: 'volumeNotFound',
      audit: [{ action: 'backup.managedVolume.blocked', noteKey: 'provisioning.audit.backup.volumeNotFound' }],
    };
  }

  // 7) Step-030-Guard (Bestätigungen). Container existiert hier nicht (oben geblockt).
  const guard = canBackupManagedVolume(
    {
      instanceId,
      mode: 'managed',
      provisioningStatus: 'RESOURCES_PREPARED',
      runState: null,
      serverDisplayName: request.serverDisplayName ?? '',
      managedVolumeName: volume,
      managedVolumeState: null,
      volume: { exists: true, managed: true },
      container: { exists: false, running: false },
    },
    {
      confirmBackupMayContainSensitiveData: request.confirmBackupMayContainSensitiveData,
      confirmBackupStorageResponsibility: request.confirmBackupStorageResponsibility,
      confirmContainerShouldBeStopped: request.confirmContainerShouldBeStopped,
      typedConfirmation: request.typedConfirmation,
    },
  );
  if (!guard.allowed) {
    return {
      status: 'blocked',
      audit: [{ action: 'backup.managedVolume.blocked', noteKey: 'provisioning.audit.backup.blocked' }],
    };
  }

  // 8) Image serverseitig vorhanden? (kein unkontrollierter Pull)
  const image = await opts.exec(['image', 'ls', '--filter', `reference=${opts.backupImage}`, '--format', '{{.ID}}']);
  if (!(image.ok && exactNames(image.stdout).length > 0)) {
    return {
      status: 'imageUnavailable',
      audit: [{ action: 'backup.managedVolume.blocked', noteKey: 'provisioning.audit.backup.imageUnavailable' }],
    };
  }

  // 9) Dateinamen intern erzeugen + read-only Backup ausführen (statische Args, keine Shell).
  const now = opts.now ?? new Date();
  const ts = safeTimestamp(now);
  const base = `speakcore-backup-ts3-${instanceId}-${ts}`;
  const tarName = `${base}.tar.gz`;
  const metaName = `${base}.metadata.json`;
  const dir = opts.backupDir.replace(/[/\\]+$/, '');

  const run = await opts.exec(
    [
      'run',
      '--rm',
      '--name',
      `speakcore-backup-${instanceId}-${now.getTime().toString(36)}`,
      '--label',
      'speakcore.managed=true',
      '--label',
      'speakcore.project=SpeakCore',
      '--label',
      `speakcore.instanceId=${instanceId}`,
      '--label',
      'speakcore.service=backup',
      '-v',
      `${volume}:/data:ro`,
      '-v',
      `${dir}:/backup`,
      opts.backupImage,
      'tar',
      '-czf',
      `/backup/${tarName}`,
      '-C',
      '/data',
      '.',
    ],
    BACKUP_TIMEOUT_MS,
  );
  if (!run.ok) {
    return {
      status: 'error',
      audit: [{ action: 'backup.managedVolume.failed', noteKey: 'provisioning.audit.backup.error' }],
    };
  }

  // 10) Metadaten schreiben (keine Secrets).
  const metadata = buildBackupMetadata({
    instanceId,
    serverDisplayName: request.serverDisplayName ?? '',
    volumeName: volume,
    backupFileName: tarName,
    createdBy: 'owner',
    createdAt: now.toISOString(),
    notes: [
      'Backup may contain sensitive TeamSpeak server data.',
      'Restore is not implemented in SpeakCore 0.1.',
    ],
  });
  const metaOk = await opts.writeMetadata(`${dir}/${metaName}`, JSON.stringify(metadata, null, 2));
  if (!metaOk) {
    return {
      status: 'error',
      audit: [{ action: 'backup.managedVolume.failed', noteKey: 'provisioning.audit.backup.metadataError' }],
    };
  }

  return {
    status: 'created',
    backupFileName: tarName,
    audit: [{ action: 'backup.managedVolume.completed', noteKey: 'provisioning.audit.backup.completed' }],
  };
}
