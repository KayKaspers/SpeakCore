import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3ContainerStopRequest } from '@speakcore/types';
import { stopTs3Container } from '../src/docker-stop';
import type { DockerExec } from '../src/docker-cli';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const CONTAINER_NAME = 'speakcore-ts3-clabc123def456';

function baseRequest(overrides: Partial<Ts3ContainerStopRequest> = {}): Ts3ContainerStopRequest {
  return { instanceId: INSTANCE, ...overrides };
}

/**
 * managedNames: als managed vorhanden (--all + instanceId-Label). runningNames: laufend (ohne --all).
 * anyNames: beliebig vorhanden (unmanaged Konflikt, name-Filter). stopOk: Ergebnis von `docker stop`.
 */
function makeExec(opts: {
  managedNames?: string[];
  runningNames?: string[];
  anyNames?: string[];
  stopOk?: boolean;
  probeOk?: boolean;
} = {}) {
  const calls: string[][] = [];
  const exec: DockerExec = async (args) => {
    calls.push(args);
    if (args[0] === 'stop') return { ok: opts.stopOk ?? true, stdout: '' };
    const instFilter = args.find((a) => a.startsWith('label=speakcore.instanceId='));
    const nameFilter = args.find((a) => a.startsWith('name='));
    const all = args.includes('--all');
    if (!instFilter && !nameFilter) {
      // Availability-Probe (managed, --all, ohne instanceId/name)
      return { ok: opts.probeOk ?? true, stdout: '' };
    }
    if (instFilter && all) {
      return { ok: true, stdout: (opts.managedNames ?? []).includes(CONTAINER_NAME) ? CONTAINER_NAME : '' };
    }
    if (instFilter && !all) {
      return { ok: true, stdout: (opts.runningNames ?? []).includes(CONTAINER_NAME) ? CONTAINER_NAME : '' };
    }
    // unmanaged Existenzprüfung (--all, name-Filter)
    const want = nameFilter ? nameFilter.slice('name='.length) : '';
    return { ok: true, stdout: (opts.anyNames ?? []).includes(want) ? want : '' };
  };
  return { exec, calls };
}

test('write disabled ⇒ no docker action, status writeDisabled', async () => {
  const { exec, calls } = makeExec();
  const result = await stopTs3Container(baseRequest(), { writeEnabled: false, exec });
  assert.equal(result.status, 'writeDisabled');
  assert.equal(calls.length, 0);
});

test('invalid instanceId ⇒ no docker action', async () => {
  const { exec, calls } = makeExec();
  const result = await stopTs3Container(baseRequest({ instanceId: 'bad id!' }), { writeEnabled: true, exec });
  assert.equal(result.status, 'invalid');
  assert.equal(calls.length, 0);
});

test('managed running container ⇒ docker stop (not rm/start/restart)', async () => {
  const { exec, calls } = makeExec({ managedNames: [CONTAINER_NAME], runningNames: [CONTAINER_NAME] });
  const result = await stopTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'stopped');
  assert.equal(result.containerName, CONTAINER_NAME);

  const stopCall = calls.find((c) => c[0] === 'stop');
  assert.ok(stopCall, 'a docker stop call must exist');
  assert.ok(stopCall!.includes(CONTAINER_NAME));
  assert.ok(!calls.some((c) => ['rm', 'start', 'restart', 'run', 'create'].includes(c[0])), 'no rm/start/restart/run/create');
});

test('managed but already stopped ⇒ idempotent (alreadyStopped, no stop call)', async () => {
  const { exec, calls } = makeExec({ managedNames: [CONTAINER_NAME], runningNames: [] });
  const result = await stopTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'alreadyStopped');
  assert.equal(calls.some((c) => c[0] === 'stop'), false);
});

test('unmanaged name conflict ⇒ conflict, no stop, no takeover', async () => {
  const { exec, calls } = makeExec({ anyNames: [CONTAINER_NAME] });
  const result = await stopTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'conflict');
  assert.equal(calls.some((c) => c[0] === 'stop'), false);
});

test('container missing ⇒ notFound, no stop', async () => {
  const { exec, calls } = makeExec();
  const result = await stopTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'notFound');
  assert.equal(calls.some((c) => c[0] === 'stop'), false);
});

test('docker unavailable ⇒ unavailable, no stop', async () => {
  const { exec, calls } = makeExec({ probeOk: false });
  const result = await stopTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'unavailable');
  assert.equal(calls.some((c) => c[0] === 'stop'), false);
});

test('stop failure ⇒ error', async () => {
  const { exec } = makeExec({ managedNames: [CONTAINER_NAME], runningNames: [CONTAINER_NAME], stopOk: false });
  const result = await stopTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'error');
});

test('result never contains secrets', async () => {
  const { exec } = makeExec({ managedNames: [CONTAINER_NAME], runningNames: [CONTAINER_NAME] });
  const result = await stopTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(JSON.stringify(result)));
});

test('POST /docker/provision/stop-container requires token and honours write flag', async () => {
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/provision/stop-container`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`http://localhost:${port}/docker/provision/stop-container`, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(baseRequest()),
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { status: string };
    assert.equal(body.status, 'writeDisabled'); // Flag false ⇒ keine Docker-Aktion
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('docker-stop sources contain no forbidden docker commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src');
  const sources = ['docker-stop.ts', 'docker-cli.ts'].map((f) => readFileSync(join(srcDir, f), 'utf8'));
  const forbidden = [
    'docker run',
    'docker create',
    "'create'",
    'docker start',
    "'start'",
    'docker restart',
    "'restart'",
    'docker rm',
    "'rm'",
    'container rm',
    'docker inspect',
    "'inspect'",
    'docker exec',
    'docker cp',
    'docker logs',
    "'logs'",
    'compose up',
    'compose down',
    'docker.sock',
    '/var/run/docker.sock',
  ];
  for (const src of sources) {
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token present: ${token}`);
    }
    assert.ok(!src.includes('shell: true'), 'shell must not be enabled');
  }
});
