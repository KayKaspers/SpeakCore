import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3VolumeRemoveRequest } from '@speakcore/types';
import { removeTs3Volume } from '../src/docker-volume-remove';
import type { DockerExec } from '../src/docker-cli';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const VOLUME = 'speakcore-volume-ts3-clabc123def456';
const CONTAINER = 'speakcore-ts3-clabc123def456';

function baseRequest(overrides: Partial<Ts3VolumeRemoveRequest> = {}): Ts3VolumeRemoveRequest {
  return { instanceId: INSTANCE, ...overrides };
}

/**
 * containerNames: managed Container mit instanceId vorhanden. managedVol: managed Volume vorhanden.
 * anyVol: gleichnamiges Volume beliebig vorhanden (Konflikt). rmOk: Ergebnis von `volume rm`.
 */
function makeExec(opts: {
  containerNames?: string[];
  managedVol?: boolean;
  anyVol?: boolean;
  rmOk?: boolean;
  probeOk?: boolean;
} = {}) {
  const calls: string[][] = [];
  const exec: DockerExec = async (args) => {
    calls.push(args);
    if (args[0] === 'volume' && args[1] === 'rm') return { ok: opts.rmOk ?? true, stdout: '' };
    const instFilter = args.find((a) => a.startsWith('label=speakcore.instanceId='));
    const nameFilter = args.find((a) => a.startsWith('name='));
    if (args[0] === 'container' && args[1] === 'ls') {
      if (!instFilter) return { ok: opts.probeOk ?? true, stdout: '' }; // Availability-Probe
      return { ok: true, stdout: (opts.containerNames ?? []).includes(CONTAINER) ? CONTAINER : '' };
    }
    // volume ls
    if (instFilter) return { ok: true, stdout: opts.managedVol ? VOLUME : '' };
    if (nameFilter) return { ok: true, stdout: opts.anyVol ? VOLUME : '' };
    return { ok: true, stdout: '' };
  };
  return { exec, calls };
}

test('write disabled ⇒ no docker action, status writeDisabled', async () => {
  const { exec, calls } = makeExec();
  const result = await removeTs3Volume(baseRequest(), { writeEnabled: false, exec });
  assert.equal(result.status, 'writeDisabled');
  assert.equal(calls.length, 0);
});

test('invalid instanceId ⇒ no docker action', async () => {
  const { exec, calls } = makeExec();
  const result = await removeTs3Volume(baseRequest({ instanceId: 'bad id!' }), { writeEnabled: true, exec });
  assert.equal(result.status, 'invalid');
  assert.equal(calls.length, 0);
});

test('managed volume + no container ⇒ docker volume rm (no -f, no network/container rm)', async () => {
  const { exec, calls } = makeExec({ managedVol: true });
  const result = await removeTs3Volume(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'removed');
  assert.equal(result.volumeName, VOLUME);

  const rmCall = calls.find((c) => c[0] === 'volume' && c[1] === 'rm');
  assert.ok(rmCall, 'a docker volume rm call must exist');
  assert.deepEqual(rmCall, ['volume', 'rm', VOLUME]); // exactly `docker volume rm <name>`
  assert.ok(!rmCall!.includes('-f') && !rmCall!.includes('--force'), 'no force remove');
  assert.ok(!calls.some((c) => c[0] === 'network'), 'no network commands');
  assert.ok(!calls.some((c) => c[0] === 'container' && c[1] === 'rm'), 'no container rm');
  assert.ok(!calls.some((c) => c[0] === 'rm'), 'no plain rm');
});

test('container still exists ⇒ blocked containerStillExists, no volume rm', async () => {
  const { exec, calls } = makeExec({ containerNames: [CONTAINER], managedVol: true });
  const result = await removeTs3Volume(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'containerStillExists');
  assert.equal(calls.some((c) => c[0] === 'volume' && c[1] === 'rm'), false);
});

test('volume missing ⇒ alreadyRemoved (idempotent), no volume rm', async () => {
  const { exec, calls } = makeExec();
  const result = await removeTs3Volume(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'alreadyRemoved');
  assert.equal(calls.some((c) => c[0] === 'volume' && c[1] === 'rm'), false);
});

test('unmanaged volume with same name ⇒ conflict, no volume rm', async () => {
  const { exec, calls } = makeExec({ managedVol: false, anyVol: true });
  const result = await removeTs3Volume(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'conflict');
  assert.equal(calls.some((c) => c[0] === 'volume' && c[1] === 'rm'), false);
});

test('docker unavailable ⇒ unavailable, no volume rm', async () => {
  const { exec, calls } = makeExec({ probeOk: false });
  const result = await removeTs3Volume(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'unavailable');
  assert.equal(calls.some((c) => c[0] === 'volume' && c[1] === 'rm'), false);
});

test('volume rm failure ⇒ error', async () => {
  const { exec } = makeExec({ managedVol: true, rmOk: false });
  const result = await removeTs3Volume(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'error');
});

test('result never contains secrets', async () => {
  const { exec } = makeExec({ managedVol: true });
  const result = await removeTs3Volume(baseRequest(), { writeEnabled: true, exec });
  assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(JSON.stringify(result)));
});

test('POST /docker/provision/remove-volume requires token and honours write flag', async () => {
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/provision/remove-volume`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`http://localhost:${port}/docker/provision/remove-volume`, {
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

test('docker-volume-remove sources contain no forbidden docker commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src');
  const sources = ['docker-volume-remove.ts', 'docker-cli.ts'].map((f) => readFileSync(join(srcDir, f), 'utf8'));
  const forbidden = [
    'volume rm -f',
    'rm -f',
    '--force',
    'network rm',
    'container rm',
    'docker rm',
    'docker run',
    'docker create',
    'docker start',
    'docker stop',
    'docker restart',
    'docker inspect',
    'docker exec',
    'docker cp',
    'docker logs',
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
