import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3ContainerRemoveRequest } from '@speakcore/types';
import { removeTs3Container } from '../src/docker-remove';
import type { DockerExec } from '../src/docker-cli';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const CONTAINER_NAME = 'speakcore-ts3-clabc123def456';

function baseRequest(overrides: Partial<Ts3ContainerRemoveRequest> = {}): Ts3ContainerRemoveRequest {
  return { instanceId: INSTANCE, ...overrides };
}

function makeExec(opts: {
  managedNames?: string[];
  runningNames?: string[];
  anyNames?: string[];
  rmOk?: boolean;
  probeOk?: boolean;
} = {}) {
  const calls: string[][] = [];
  const exec: DockerExec = async (args) => {
    calls.push(args);
    if (args[0] === 'rm') return { ok: opts.rmOk ?? true, stdout: '' };
    const instFilter = args.find((a) => a.startsWith('label=speakcore.instanceId='));
    const nameFilter = args.find((a) => a.startsWith('name='));
    const all = args.includes('--all');
    if (!instFilter && !nameFilter) {
      return { ok: opts.probeOk ?? true, stdout: '' }; // Availability-Probe
    }
    if (instFilter && all) {
      return { ok: true, stdout: (opts.managedNames ?? []).includes(CONTAINER_NAME) ? CONTAINER_NAME : '' };
    }
    if (instFilter && !all) {
      return { ok: true, stdout: (opts.runningNames ?? []).includes(CONTAINER_NAME) ? CONTAINER_NAME : '' };
    }
    const want = nameFilter ? nameFilter.slice('name='.length) : '';
    return { ok: true, stdout: (opts.anyNames ?? []).includes(want) ? want : '' };
  };
  return { exec, calls };
}

test('write disabled ⇒ no docker action, status writeDisabled', async () => {
  const { exec, calls } = makeExec();
  const result = await removeTs3Container(baseRequest(), { writeEnabled: false, exec });
  assert.equal(result.status, 'writeDisabled');
  assert.equal(calls.length, 0);
});

test('invalid instanceId ⇒ no docker action', async () => {
  const { exec, calls } = makeExec();
  const result = await removeTs3Container(baseRequest({ instanceId: 'bad id!' }), { writeEnabled: true, exec });
  assert.equal(result.status, 'invalid');
  assert.equal(calls.length, 0);
});

test('managed stopped container ⇒ docker rm (no -f/-v, no volume/network rm)', async () => {
  const { exec, calls } = makeExec({ managedNames: [CONTAINER_NAME], runningNames: [] });
  const result = await removeTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'removed');
  assert.equal(result.containerName, CONTAINER_NAME);

  const rmCall = calls.find((c) => c[0] === 'rm');
  assert.ok(rmCall, 'a docker rm call must exist');
  assert.deepEqual(rmCall, ['rm', CONTAINER_NAME]); // exactly `docker rm <name>`
  assert.ok(!rmCall!.includes('-f') && !rmCall!.includes('--force'), 'no force remove');
  assert.ok(!rmCall!.includes('-v') && !rmCall!.includes('--volumes'), 'no volume remove');
  assert.ok(!calls.some((c) => c[0] === 'volume' || c[0] === 'network'), 'no volume/network commands');
  assert.ok(!calls.some((c) => ['run', 'create', 'start', 'stop', 'restart'].includes(c[0])), 'no other write cmds');
});

test('managed but still running ⇒ stillRunning, no rm', async () => {
  const { exec, calls } = makeExec({ managedNames: [CONTAINER_NAME], runningNames: [CONTAINER_NAME] });
  const result = await removeTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'stillRunning');
  assert.equal(calls.some((c) => c[0] === 'rm'), false);
});

test('container missing ⇒ alreadyRemoved (idempotent), no rm', async () => {
  const { exec, calls } = makeExec();
  const result = await removeTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'alreadyRemoved');
  assert.equal(calls.some((c) => c[0] === 'rm'), false);
});

test('unmanaged name conflict ⇒ conflict, no rm, no takeover', async () => {
  const { exec, calls } = makeExec({ anyNames: [CONTAINER_NAME] });
  const result = await removeTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'conflict');
  assert.equal(calls.some((c) => c[0] === 'rm'), false);
});

test('docker unavailable ⇒ unavailable, no rm', async () => {
  const { exec, calls } = makeExec({ probeOk: false });
  const result = await removeTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'unavailable');
  assert.equal(calls.some((c) => c[0] === 'rm'), false);
});

test('rm failure ⇒ error', async () => {
  const { exec } = makeExec({ managedNames: [CONTAINER_NAME], runningNames: [], rmOk: false });
  const result = await removeTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'error');
});

test('result never contains secrets', async () => {
  const { exec } = makeExec({ managedNames: [CONTAINER_NAME], runningNames: [] });
  const result = await removeTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(JSON.stringify(result)));
});

test('POST /docker/provision/remove-container requires token and honours write flag', async () => {
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/provision/remove-container`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`http://localhost:${port}/docker/provision/remove-container`, {
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

test('docker-remove sources contain no forbidden docker commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src');
  const sources = ['docker-remove.ts', 'docker-cli.ts'].map((f) => readFileSync(join(srcDir, f), 'utf8'));
  const forbidden = [
    'rm -f',
    'rm -v',
    "'-f'",
    "'-v'",
    "'--force'",
    "'--volumes'",
    'volume rm',
    'network rm',
    'docker run',
    'docker create',
    'docker start',
    'docker stop',
    'docker restart',
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
