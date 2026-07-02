/**
 * Managed TS3-**Datenvolume entfernen** (NDF Step 025) – ausschließlich `docker volume rm`, sonst nichts.
 *
 * **Datenverlust!** STRIKT: **kein Force-Remove**, kein Netzwerk- oder Container-Löschen, kein
 * `run`/`create`/`start`/`stop`/`restart`/`inspect`/`exec`/`cp`/`logs`, kein `compose`, kein Socket, keine
 * Shell, keine freien Namen/Wildcards. Entfernt **nur** ein SpeakCore-**managed** Volume (Name aus `instanceId` +
 * managed-/instanceId-Label geprüft) und **nur**, wenn **kein Container** mehr existiert. Fehlt das Volume
 * ⇒ `alreadyRemoved` (idempotent); fremdes gleichnamiges Volume ⇒ `conflict`; Container noch da ⇒
 * `containerStillExists`. **Network/Credentials/ServerInstance werden NICHT angetastet.** Keine Secrets/Logs.
 */
import { containerName, defaultVolumeName, isValidInstanceId } from '@speakcore/shared';
import type { Ts3VolumeRemoveRequest, VolumeRemoveResult } from '@speakcore/types';
import type { DockerExec } from './docker-cli';

function exactNames(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter((l) => l.length > 0);
}

export interface VolumeRemoveOptions {
  writeEnabled: boolean;
  exec: DockerExec;
}

export async function removeTs3Volume(
  request: Ts3VolumeRemoveRequest,
  opts: VolumeRemoveOptions,
): Promise<VolumeRemoveResult> {
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

  // Availability-Probe (managed gefiltert – enumeriert keine fremden Ressourcen).
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

  // 1) Existiert noch ein managed Container mit dieser instanceId? → blockieren.
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
      audit: [
        { action: 'deprovision.volumeRemove.blocked', noteKey: 'provisioning.audit.volume.containerStillExists' },
      ],
    };
  }

  // 2)/3) Managed Volume für diese instanceId vorhanden?
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
    // Gleichnamiges, NICHT verwaltetes Volume? → Konflikt (nicht anfassen). Sonst fehlt es → idempotent.
    const any = await opts.exec(['volume', 'ls', '--filter', `name=${volume}`, '--format', '{{.Name}}']);
    if (any.ok && exactNames(any.stdout).includes(volume)) {
      return {
        status: 'conflict',
        audit: [{ action: 'deprovision.volumeRemove.conflict', noteKey: 'provisioning.audit.volume.conflict' }],
      };
    }
    return {
      status: 'alreadyRemoved',
      volumeName: volume,
      audit: [{ action: 'deprovision.volume.alreadyRemoved', noteKey: 'provisioning.audit.volume.alreadyRemoved' }],
    };
  }

  // 4) ENTFERNEN (kein -f). `docker volume rm <name>` – irreversibel.
  const removed = await opts.exec(['volume', 'rm', volume]);
  if (!removed.ok) {
    return {
      status: 'error',
      audit: [{ action: 'deprovision.volumeRemove.failed', noteKey: 'provisioning.audit.volume.error' }],
    };
  }

  return {
    status: 'removed',
    volumeName: volume,
    audit: [{ action: 'deprovision.volume.removed', noteKey: 'provisioning.audit.volume.removed' }],
  };
}
