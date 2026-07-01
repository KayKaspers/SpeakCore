import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3ContainerStartRequest } from '@speakcore/types';
import { startTs3Container } from '../src/docker-start';
import type { DockerExec } from '../src/docker-cli';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const CONTAINER_NAME = 'speakcore-ts3-clabc123def456';

function baseRequest(overrides: Partial<Ts3ContainerStartRequest> = {}): Ts3ContainerStartRequest {
  return { instanceId: INSTANCE, licenseAccepted: true, ...overrides };
}

/**
 * managedNames: als managed vorhanden (--all). runningNames: laufend (ohne --all).
 * anyNames: beliebig vorhanden (unmanaged Konflikt). startOk: Ergebnis von `docker start`.
 */
function makeExec(opts: {
  managedNames?: string[];
  runningNames?: string[];
  anyNames?: string[];
  startOk?: boolean;
  probeOk?: boolean;
} = {}) {
  const calls: string[][] = [];
  const exec: DockerExec = async (args) => {
    calls.push(args);
    if (args[0] === 'start') return { ok: opts.startOk ?? true, stdout: '' };
    // container ls ...
    const nameArg = args.find((a) => a.startsWith('name='));
    const wantName = nameArg ? nameArg.slice('name='.length) : null;
    const managedFilter = args.includes('label=speakcore.managed=true');
    const all = args.includes('--all');
    if (!wantName) {
      // Availability-Probe (managed, --all)
      return { ok: opts.probeOk ?? true, stdout: '' };
    }
    if (managedFilter && all) {
      return { ok: true, stdout: (opts.managedNames ?? []).includes(wantName) ? wantName : '' };
    }
    if (managedFilter && !all) {
      // laufende managed Container
      return { ok: true, stdout: (opts.runningNames ?? []).includes(wantName) ? wantName : '' };
    }
    // unmanaged Existenzprüfung (--all, ohne managed-Label)
    return { ok: true, stdout: (opts.anyNames ?? []).includes(wantName) ? wantName : '' };
  };
  return { exec, calls };
}

test('write disabled ⇒ no docker action, status writeDisabled', async () => {
  const { exec, calls } = makeExec();
  const result = await startTs3Container(baseRequest(), { writeEnabled: false, exec });
  assert.equal(result.status, 'writeDisabled');
  assert.equal(calls.length, 0);
});

test('missing license confirmation ⇒ no start, invalid (licenseRequired)', async () => {
  const { exec, calls } = makeExec({ managedNames: [CONTAINER_NAME] });
  const result = await startTs3Container(baseRequest({ licenseAccepted: false }), {
    writeEnabled: true,
    exec,
  });
  assert.equal(result.status, 'invalid');
  assert.ok(result.errors?.some((e) => e.code === 'licenseRequired'));
  assert.equal(calls.length, 0);
});

test('invalid instanceId ⇒ no docker action', async () => {
  const { exec, calls } = makeExec();
  const result = await startTs3Container(baseRequest({ instanceId: 'bad id!' }), {
    writeEnabled: true,
    exec,
  });
  assert.equal(result.status, 'invalid');
  assert.equal(calls.length, 0);
});

test('managed container exists (not running) ⇒ docker start (not run/create)', async () => {
  const { exec, calls } = makeExec({ managedNames: [CONTAINER_NAME] });
  const result = await startTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'started');
  assert.equal(result.containerName, CONTAINER_NAME);

  const startCall = calls.find((c) => c[0] === 'start');
  assert.ok(startCall, 'a docker start call must exist');
  assert.deepEqual(startCall, ['start', CONTAINER_NAME]);
  assert.ok(!calls.some((c) => c[0] === 'run' || c[0] === 'create'), 'never run/create');
});

test('already running ⇒ idempotent (running, no start call)', async () => {
  const { exec, calls } = makeExec({ managedNames: [CONTAINER_NAME], runningNames: [CONTAINER_NAME] });
  const result = await startTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'running');
  assert.equal(calls.some((c) => c[0] === 'start'), false);
});

test('unmanaged name conflict ⇒ conflict, no start, no takeover', async () => {
  const { exec, calls } = makeExec({ anyNames: [CONTAINER_NAME] });
  const result = await startTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'conflict');
  assert.equal(calls.some((c) => c[0] === 'start'), false);
});

test('container missing ⇒ notFound, no start, no false RUNNING', async () => {
  const { exec, calls } = makeExec();
  const result = await startTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'notFound');
  assert.equal(calls.some((c) => c[0] === 'start'), false);
});

test('docker unavailable ⇒ unavailable, no start', async () => {
  const { exec, calls } = makeExec({ probeOk: false });
  const result = await startTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'unavailable');
  assert.equal(calls.some((c) => c[0] === 'start'), false);
});

test('start failure ⇒ error', async () => {
  const { exec } = makeExec({ managedNames: [CONTAINER_NAME], startOk: false });
  const result = await startTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'error');
});

test('result never contains secrets', async () => {
  const { exec } = makeExec({ managedNames: [CONTAINER_NAME] });
  const result = await startTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(JSON.stringify(result)));
});

test('POST /docker/provision/start-container requires token and honours write flag', async () => {
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/provision/start-container`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`http://localhost:${port}/docker/provision/start-container`, {
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

test('docker-start sources contain no forbidden docker commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src');
  const sources = ['docker-start.ts', 'docker-cli.ts'].map((f) => readFileSync(join(srcDir, f), 'utf8'));
  const forbidden = [
    'docker run',
    'docker create',
    "'create'",
    'docker stop',
    "'stop'",
    'docker rm',
    'container rm',
    'docker inspect',
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
