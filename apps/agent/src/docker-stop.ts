/**
 * Managed TS3-Container **stoppen** (NDF Step 021) – ausschließlich `docker stop`, sonst nichts.
 *
 * STRIKT: kein `run`/`create`/`start`/`restart`/`rm`/`inspect`/`exec`/`cp`/`logs`, kein `compose`,
 * kein Socket, keine Shell, keine freien Nutzerparameter. Gestoppt wird **nur** ein bereits
 * vorhandener, SpeakCore-**managed** Container (Name aus `instanceId` abgeleitet, Managed-/instanceId-
 * Label geprüft). Idempotent (läuft nicht mehr ⇒ `alreadyStopped`); gleichnamiger fremder Container ⇒
 * `conflict`; fehlt ⇒ `notFound`. Es werden **keine** Secrets zurückgegeben und **keine** Logs gelesen.
 * Der Container wird **nicht gelöscht** (kein `rm`), Volume/Network bleiben bestehen.
 */
import { containerName, isValidInstanceId } from '@speakcore/shared';
import type { ContainerStopResult, Ts3ContainerStopRequest } from '@speakcore/types';
import type { DockerExec } from './docker-cli';

function exactNames(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter((l) => l.length > 0);
}

export interface StopContainerOptions {
  writeEnabled: boolean;
  exec: DockerExec;
}

export async function stopTs3Container(
  request: Ts3ContainerStopRequest,
  opts: StopContainerOptions,
): Promise<ContainerStopResult> {
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

  const name = containerName(instanceId);

  // Availability-Probe (nur managed gefiltert – enumeriert keine fremden Container).
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

  // Existiert der Container als SpeakCore-managed (beliebiger Zustand)?
  const managed = await opts.exec([
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
  const isManaged = managed.ok && exactNames(managed.stdout).includes(name);

  if (!isManaged) {
    // Gleichnamiger, NICHT verwalteter Container? → Konflikt (nicht anfassen/übernehmen).
    const any = await opts.exec([
      'container',
      'ls',
      '--all',
      '--filter',
      `name=${name}`,
      '--format',
      '{{.Names}}',
    ]);
    if (any.ok && exactNames(any.stdout).includes(name)) {
      return {
        status: 'conflict',
        audit: [{ action: 'docker.container.conflict', noteKey: 'provisioning.audit.container.conflict' }],
      };
    }
    return { status: 'notFound', audit: [] };
  }

  // Läuft der managed Container überhaupt? (laufende Liste = ohne --all) → sonst idempotent.
  const running = await opts.exec([
    'container',
    'ls',
    '--filter',
    'label=speakcore.managed=true',
    '--filter',
    `label=speakcore.instanceId=${instanceId}`,
    '--format',
    '{{.Names}}',
  ]);
  if (!(running.ok && exactNames(running.stdout).includes(name))) {
    return {
      status: 'alreadyStopped',
      containerName: name,
      audit: [
        { action: 'docker.container.alreadyStopped', noteKey: 'provisioning.audit.container.alreadyStopped' },
      ],
    };
  }

  // STOPPEN (kein rm/restart). `docker stop --time 3 <name>` – feste, interne Kulanzzeit (SIGTERM,
  // nach 3 s SIGKILL), damit der Stop innerhalb des CLI-Timeouts abschließt. Keine Logs, kein Attach.
  const stopped = await opts.exec(['stop', '--time', '3', name]);
  if (!stopped.ok) {
    return {
      status: 'error',
      audit: [{ action: 'docker.container.error', noteKey: 'provisioning.audit.container.error' }],
    };
  }

  return {
    status: 'stopped',
    containerName: name,
    audit: [{ action: 'docker.container.stopped', noteKey: 'provisioning.audit.container.stopped' }],
  };
}
