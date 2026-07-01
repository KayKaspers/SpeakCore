/**
 * Managed TS3-Container **starten** (NDF Step 018) – ausschließlich `docker start`, sonst nichts.
 *
 * STRIKT: kein `run`/`create`/`stop`/`rm`/`inspect`/`exec`/`cp`/`logs`, kein `compose`, kein Socket,
 * keine Shell, keine freien Nutzerparameter. Gestartet wird **nur** ein bereits vorhandener,
 * SpeakCore-**managed** Container (Name aus `instanceId` abgeleitet, Managed-Label geprüft).
 * Idempotent (läuft bereits ⇒ `running`); gleichnamiger fremder Container ⇒ `conflict`; fehlt ⇒ `notFound`.
 *
 * Der Start erfordert eine explizite Lizenzzustimmung (`licenseAccepted === true`) – Defense-in-Depth
 * zusätzlich zur Web-Prüfung. Es werden **keine** Secrets/ENV übergeben und **keine** Logs gelesen.
 */
import { containerName, isValidInstanceId } from '@speakcore/shared';
import type { ContainerStartResult, Ts3ContainerStartRequest } from '@speakcore/types';
import type { DockerExec } from './docker-cli';

function exactNames(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter((l) => l.length > 0);
}

export interface StartContainerOptions {
  writeEnabled: boolean;
  exec: DockerExec;
}

export async function startTs3Container(
  request: Ts3ContainerStartRequest,
  opts: StartContainerOptions,
): Promise<ContainerStartResult> {
  if (!opts.writeEnabled) {
    return { status: 'writeDisabled', audit: [] };
  }

  if (typeof request !== 'object' || request === null) {
    return { status: 'invalid', errors: [{ code: 'inputInvalid' }], audit: [] };
  }

  const { instanceId, licenseAccepted } = request;

  // Ohne explizite Lizenzzustimmung wird NICHT gestartet.
  if (licenseAccepted !== true) {
    return { status: 'invalid', errors: [{ code: 'licenseRequired' }], audit: [] };
  }
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
    `name=${name}`,
    '--filter',
    'label=speakcore.managed=true',
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

  // Läuft der managed Container bereits? (laufende Liste = ohne --all) → idempotent.
  const running = await opts.exec([
    'container',
    'ls',
    '--filter',
    `name=${name}`,
    '--filter',
    'label=speakcore.managed=true',
    '--format',
    '{{.Names}}',
  ]);
  if (running.ok && exactNames(running.stdout).includes(name)) {
    return {
      status: 'running',
      containerName: name,
      audit: [
        { action: 'docker.container.alreadyRunning', noteKey: 'provisioning.audit.container.alreadyRunning' },
      ],
    };
  }

  // STARTEN (nicht run/create). `docker start <name>` – keine Logs, kein Attach.
  const started = await opts.exec(['start', name]);
  if (!started.ok) {
    return {
      status: 'error',
      audit: [{ action: 'docker.container.error', noteKey: 'provisioning.audit.container.error' }],
    };
  }

  return {
    status: 'started',
    containerName: name,
    audit: [{ action: 'docker.container.started', noteKey: 'provisioning.audit.container.started' }],
  };
}
