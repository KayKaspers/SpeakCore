import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { removeTs3Network } from '../src/docker-network-remove';
import type { DockerExec } from '../src/docker-cli';
import { buildServer } from '../src/server';

const NETWORK = 'speakcore-network-voice';

/**
 * managedContainers: es existieren managed Container. managedNet: managed voice-network vorhanden.
 * anyNet: gleichnamiges Network beliebig vorhanden (Konflikt). rmOk: Ergebnis von `network rm`.
 */
function makeExec(opts: {
  managedContainers?: string[];
  managedNet?: boolean;
  anyNet?: boolean;
  rmOk?: boolean;
  probeOk?: boolean;
} = {}) {
  const calls: string[][] = [];
  const exec: DockerExec = async (args) => {
    calls.push(args);
    if (args[0] === 'network' && args[1] === 'rm') return { ok: opts.rmOk ?? true, stdout: '' };
    if (args[0] === 'container' && args[1] === 'ls') {
      return { ok: opts.probeOk ?? true, stdout: (opts.managedContainers ?? []).join('\n') };
    }
    // network ls
    const serviceFilter = args.includes('label=speakcore.service=voice-network');
    const nameFilter = args.find((a) => a.startsWith('name='));
    if (serviceFilter) return { ok: true, stdout: opts.managedNet ? NETWORK : '' };
    if (nameFilter) return { ok: true, stdout: opts.anyNet ? NETWORK : '' };
    return { ok: true, stdout: '' };
  };
  return { exec, calls };
}

test('write disabled ⇒ no docker action, status writeDisabled', async () => {
  const { exec, calls } = makeExec();
  const result = await removeTs3Network({ writeEnabled: false, exec });
  assert.equal(result.status, 'writeDisabled');
  assert.equal(calls.length, 0);
});

test('managed container still exists ⇒ inUseByManagedContainers, no network rm', async () => {
  const { exec, calls } = makeExec({ managedContainers: ['speakcore-ts3-clabc'], managedNet: true });
  const result = await removeTs3Network({ writeEnabled: true, exec });
  assert.equal(result.status, 'inUseByManagedContainers');
  assert.equal(calls.some((c) => c[0] === 'network' && c[1] === 'rm'), false);
});

test('managed network + no containers ⇒ docker network rm (no force, no volume/container rm)', async () => {
  const { exec, calls } = makeExec({ managedNet: true });
  const result = await removeTs3Network({ writeEnabled: true, exec });
  assert.equal(result.status, 'removed');
  assert.equal(result.networkName, NETWORK);

  const rmCall = calls.find((c) => c[0] === 'network' && c[1] === 'rm');
  assert.ok(rmCall, 'a docker network rm call must exist');
  assert.deepEqual(rmCall, ['network', 'rm', NETWORK]); // exactly `docker network rm <name>`
  assert.ok(!rmCall!.includes('-f') && !rmCall!.includes('--force'), 'no force remove');
  assert.ok(!calls.some((c) => c[0] === 'volume'), 'no volume commands');
  assert.ok(!calls.some((c) => c[0] === 'container' && c[1] === 'rm'), 'no container rm');
  assert.ok(!calls.some((c) => c[0] === 'rm'), 'no plain rm');
});

test('network missing ⇒ alreadyRemoved (idempotent), no network rm', async () => {
  const { exec, calls } = makeExec();
  const result = await removeTs3Network({ writeEnabled: true, exec });
  assert.equal(result.status, 'alreadyRemoved');
  assert.equal(calls.some((c) => c[0] === 'network' && c[1] === 'rm'), false);
});

test('unmanaged network with same name ⇒ conflict, no network rm', async () => {
  const { exec, calls } = makeExec({ managedNet: false, anyNet: true });
  const result = await removeTs3Network({ writeEnabled: true, exec });
  assert.equal(result.status, 'conflict');
  assert.equal(calls.some((c) => c[0] === 'network' && c[1] === 'rm'), false);
});

test('docker unavailable ⇒ unavailable, no network rm', async () => {
  const { exec, calls } = makeExec({ probeOk: false });
  const result = await removeTs3Network({ writeEnabled: true, exec });
  assert.equal(result.status, 'unavailable');
  assert.equal(calls.some((c) => c[0] === 'network' && c[1] === 'rm'), false);
});

test('network rm failure ⇒ error', async () => {
  const { exec } = makeExec({ managedNet: true, rmOk: false });
  const result = await removeTs3Network({ writeEnabled: true, exec });
  assert.equal(result.status, 'error');
});

test('result never contains secrets', async () => {
  const { exec } = makeExec({ managedNet: true });
  const result = await removeTs3Network({ writeEnabled: true, exec });
  assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(JSON.stringify(result)));
});

test('POST /docker/provision/remove-network requires token and honours write flag', async () => {
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/provision/remove-network`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`http://localhost:${port}/docker/provision/remove-network`, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { status: string };
    assert.equal(body.status, 'writeDisabled'); // Flag false ⇒ keine Docker-Aktion
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('docker-network-remove sources contain no forbidden docker commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src');
  const sources = ['docker-network-remove.ts', 'docker-cli.ts'].map((f) => readFileSync(join(srcDir, f), 'utf8'));
  const forbidden = [
    'network rm -f',
    'rm -f',
    '--force',
    'volume rm',
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
