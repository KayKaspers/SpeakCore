import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { getManagedContainerStatus, normalizeContainerState } from '../src/docker-status';
import type { DockerExec } from '../src/docker-cli';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const CONTAINER_NAME = 'speakcore-ts3-clabc123def456';
const VALID = new Set(['running', 'created', 'exited', 'notFound', 'conflict', 'unavailable', 'error']);

function makeExec(opts: { managedRow?: string; managedOk?: boolean; anyNames?: string[] } = {}) {
  const calls: string[][] = [];
  const exec: DockerExec = async (args) => {
    calls.push(args);
    const instFilter = args.find((a) => a.startsWith('label=speakcore.instanceId='));
    const nameFilter = args.find((a) => a.startsWith('name='));
    if (instFilter) {
      if (opts.managedOk === false) return { ok: false, stdout: '' };
      return { ok: true, stdout: opts.managedRow ?? '' };
    }
    if (nameFilter) {
      const want = nameFilter.slice('name='.length);
      return { ok: true, stdout: (opts.anyNames ?? []).includes(want) ? want : '' };
    }
    return { ok: true, stdout: '' };
  };
  return { exec, calls };
}

test('normalizeContainerState maps docker states', () => {
  assert.equal(normalizeContainerState('running'), 'running');
  assert.equal(normalizeContainerState('created'), 'created');
  assert.equal(normalizeContainerState('exited'), 'exited');
  assert.equal(normalizeContainerState('paused'), 'exited');
  assert.equal(normalizeContainerState('restarting'), 'exited');
});

test('running managed container ⇒ running (managed+instanceId label filter used)', async () => {
  const { exec, calls } = makeExec({ managedRow: `${CONTAINER_NAME}|running` });
  const result = await getManagedContainerStatus({ instanceId: INSTANCE }, { exec });
  assert.equal(result.status, 'running');
  assert.equal(result.containerName, CONTAINER_NAME);

  const managedCall = calls.find((c) => c.some((a) => a.startsWith('label=speakcore.instanceId=')));
  assert.ok(managedCall);
  assert.ok(managedCall!.includes('label=speakcore.managed=true'));
  assert.ok(managedCall!.includes(`label=speakcore.instanceId=${INSTANCE}`));
  // read-only: nur `container ls`, keine schreibenden/inspizierenden Kommandos
  assert.ok(!calls.some((c) => ['inspect', 'logs', 'start', 'stop', 'rm', 'run', 'create'].includes(c[1])));
});

test('created / exited states are normalized', async () => {
  const created = await getManagedContainerStatus(
    { instanceId: INSTANCE },
    makeExec({ managedRow: `${CONTAINER_NAME}|created` }),
  );
  assert.equal(created.status, 'created');
  const exited = await getManagedContainerStatus(
    { instanceId: INSTANCE },
    makeExec({ managedRow: `${CONTAINER_NAME}|exited` }),
  );
  assert.equal(exited.status, 'exited');
});

test('no managed container + no same-name container ⇒ notFound', async () => {
  const { exec } = makeExec();
  const result = await getManagedContainerStatus({ instanceId: INSTANCE }, { exec });
  assert.equal(result.status, 'notFound');
});

test('no managed container but same name exists unmanaged ⇒ conflict', async () => {
  const { exec } = makeExec({ anyNames: [CONTAINER_NAME] });
  const result = await getManagedContainerStatus({ instanceId: INSTANCE }, { exec });
  assert.equal(result.status, 'conflict');
});

test('docker unavailable ⇒ unavailable', async () => {
  const { exec } = makeExec({ managedOk: false });
  const result = await getManagedContainerStatus({ instanceId: INSTANCE }, { exec });
  assert.equal(result.status, 'unavailable');
});

test('invalid instanceId ⇒ error, no docker calls', async () => {
  const { exec, calls } = makeExec();
  const result = await getManagedContainerStatus({ instanceId: 'bad id!' }, { exec });
  assert.equal(result.status, 'error');
  assert.equal(calls.length, 0);
});

test('result never contains secrets or foreign details', async () => {
  const { exec } = makeExec({ managedRow: `${CONTAINER_NAME}|running` });
  const result = await getManagedContainerStatus({ instanceId: INSTANCE }, { exec });
  assert.ok(!/password|secret|token|serveradmin/i.test(JSON.stringify(result)));
});

test('POST /docker/provision/container-status is token-gated and read-only (no write flag needed)', async () => {
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/provision/container-status`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`http://localhost:${port}/docker/provision/container-status`, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify({ instanceId: INSTANCE }),
    });
    assert.equal(ok.status, 200); // read-only funktioniert OHNE Write-Flag
    const body = (await ok.json()) as { status: string };
    assert.ok(VALID.has(body.status), `unexpected status: ${body.status}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('docker-status sources contain no forbidden docker commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src');
  const sources = ['docker-status.ts', 'docker-cli.ts'].map((f) => readFileSync(join(srcDir, f), 'utf8'));
  const forbidden = [
    'docker inspect',
    "'inspect'",
    'docker logs',
    "'logs'",
    'docker exec',
    "'exec'",
    'docker start',
    "'start'",
    'docker stop',
    "'stop'",
    'docker rm',
    'container rm',
    'docker run',
    'docker create',
    "'create'",
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
