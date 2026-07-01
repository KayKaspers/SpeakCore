/**
 * Read-only Laufzeit-Status eines managed TS3-Containers (NDF Step 019).
 *
 * STRIKT lesend: ausschließlich `docker container ls` mit **Label-Filtern** (managed + instanceId)
 * bzw. dem intern abgeleiteten Namen. **Kein** `inspect`/`logs`/`exec`/`start`/`stop`/`rm`/`run`/
 * `create`, kein compose, kein Socket, keine Shell, keine Logs. Der Containername wird aus der
 * `instanceId` abgeleitet (keine freien Namen aus dem Client). Es werden **keine** fremden
 * Containerdetails und **keine** Roh-Ausgaben zurückgegeben – nur der normalisierte Zustand.
 */
import { containerName, isValidInstanceId } from '@speakcore/shared';
import type { ContainerRuntimeStatus, ContainerStatusResult, Ts3ContainerStatusRequest } from '@speakcore/types';
import type { DockerExec } from './docker-cli';

interface StatusRow {
  name: string;
  state: string;
}

function parseStatusRows(stdout: string): StatusRow[] {
  const rows: StatusRow[] = [];
  for (const raw of stdout.split('\n')) {
    const line = raw.replace(/\r$/, '').trim();
    if (!line) continue;
    const sep = line.indexOf('|');
    if (sep === -1) {
      rows.push({ name: line, state: '' });
    } else {
      rows.push({ name: line.slice(0, sep), state: line.slice(sep + 1).trim() });
    }
  }
  return rows;
}

function exactNames(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter((l) => l.length > 0);
}

/** Normalisiert Dockers `{{.State}}` auf den read-only Statusbereich (keine Roh-Ausgabe nach außen). */
export function normalizeContainerState(state: string): ContainerRuntimeStatus {
  const s = state.toLowerCase();
  if (s === 'running') return 'running';
  if (s === 'created') return 'created';
  // exited/paused/restarting/dead/removing ⇒ „nicht laufend".
  return 'exited';
}

export interface ContainerStatusOptions {
  exec: DockerExec;
}

export async function getManagedContainerStatus(
  request: Ts3ContainerStatusRequest,
  opts: ContainerStatusOptions,
): Promise<ContainerStatusResult> {
  if (typeof request !== 'object' || request === null) return { status: 'error' };
  const { instanceId } = request;
  if (typeof instanceId !== 'string' || !isValidInstanceId(instanceId)) return { status: 'error' };

  const name = containerName(instanceId);

  // Managed Container mit dieser instanceId (inkl. gestoppt via --all).
  const managed = await opts.exec([
    'container',
    'ls',
    '--all',
    '--filter',
    'label=speakcore.managed=true',
    '--filter',
    `label=speakcore.instanceId=${instanceId}`,
    '--format',
    '{{.Names}}|{{.State}}',
  ]);
  if (!managed.ok) {
    return { status: 'unavailable' };
  }

  const rows = parseStatusRows(managed.stdout);
  const row = rows.find((r) => r.name === name) ?? rows[0];
  if (row) {
    return { status: normalizeContainerState(row.state), containerName: name };
  }

  // Kein managed Container mit dieser instanceId → gleichnamiger fremder Container? sonst notFound.
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
    return { status: 'conflict', containerName: name };
  }
  return { status: 'notFound' };
}
