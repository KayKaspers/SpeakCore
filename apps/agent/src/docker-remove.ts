/**
 * Managed TS3-Container **entfernen** (NDF Step 022) – ausschließlich `docker rm`, sonst nichts.
 *
 * STRIKT: kein `-f`/`-v`/`--force`/`--volumes`, kein `run`/`create`/`start`/`stop`/`restart`, kein
 * Volume-/Network-Remove, kein `inspect`/`exec`/`cp`/`logs`, kein `compose`, kein Socket, keine Shell.
 * Entfernt **nur** einen bereits vorhandenen, SpeakCore-**managed**, **nicht laufenden** Container
 * (Name aus `instanceId` abgeleitet, Managed-/instanceId-Label geprüft). Läuft er noch ⇒ `stillRunning`
 * (kein Remove). Fremder gleichnamiger Container ⇒ `conflict`. Fehlt er ⇒ `alreadyRemoved` (idempotent).
 * **Volume/Network/Credentials/ServerInstance werden NICHT angetastet.** Keine Logs, keine Secrets.
 */
import { containerName, isValidInstanceId } from '@speakcore/shared';
import type { ContainerRemoveResult, Ts3ContainerRemoveRequest } from '@speakcore/types';
import type { DockerExec } from './docker-cli';

function exactNames(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter((l) => l.length > 0);
}

export interface RemoveContainerOptions {
  writeEnabled: boolean;
  exec: DockerExec;
}

export async function removeTs3Container(
  request: Ts3ContainerRemoveRequest,
  opts: RemoveContainerOptions,
): Promise<ContainerRemoveResult> {
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
    // Gleichnamiger, NICHT verwalteter Container? → Konflikt (nicht anfassen/entfernen).
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
    // Kein managed Container mehr vorhanden → idempotent (Ziel bereits erreicht).
    return {
      status: 'alreadyRemoved',
      containerName: name,
      audit: [
        { action: 'docker.container.alreadyRemoved', noteKey: 'provisioning.audit.container.alreadyRemoved' },
      ],
    };
  }

  // Läuft der managed Container noch? (laufende Liste = ohne --all) → kein Remove.
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
  if (running.ok && exactNames(running.stdout).includes(name)) {
    return {
      status: 'stillRunning',
      containerName: name,
      audit: [
        { action: 'docker.containerRemove.stillRunning', noteKey: 'provisioning.audit.container.stillRunning' },
      ],
    };
  }

  // ENTFERNEN (kein -f/-v). `docker rm <name>` – nur der gestoppte Container, keine Volumes.
  const removed = await opts.exec(['rm', name]);
  if (!removed.ok) {
    return {
      status: 'error',
      audit: [{ action: 'docker.container.error', noteKey: 'provisioning.audit.container.error' }],
    };
  }

  return {
    status: 'removed',
    containerName: name,
    audit: [{ action: 'docker.container.removed', noteKey: 'provisioning.audit.container.removed' }],
  };
}
