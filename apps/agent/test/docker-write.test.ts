import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3ProvisionInput } from '@speakcore/types';
import { prepareProvision } from '../src/docker-write';
import type { DockerExec } from '../src/docker-cli';
import { buildServer } from '../src/server';

const NETWORK_NAME = 'speakcore-network-voice';
const VOLUME_NAME = 'speakcore-volume-ts3-clabc123def456';

function baseInput(overrides: Partial<Ts3ProvisionInput> = {}): Ts3ProvisionInput {
  return {
    instanceId: 'clabc123def456',
    displayName: 'My Community',
    voicePort: 9987,
    queryPort: 10011,
    fileTransferPort: 30033,
    imageName: 'teamspeak',
    restartPolicy: 'unless-stopped',
    mode: 'simple',
    ...overrides,
  };
}

function makeExec(opts: { managedNames?: string[]; anyNames?: string[]; createOk?: boolean } = {}) {
  const calls: string[][] = [];
  const exec: DockerExec = async (args) => {
    calls.push(args);
    if (args[1] === 'create') return { ok: opts.createOk ?? true, stdout: '' };
    const nameArg = args.find((a) => a.startsWith('name='));
    const wantName = nameArg ? nameArg.slice('name='.length) : null;
    const managedFilter = args.includes('label=speakcore.managed=true');
    if (managedFilter) {
      if (!wantName) return { ok: true, stdout: '' }; // Availability-Probe
      return { ok: true, stdout: (opts.managedNames ?? []).includes(wantName) ? wantName : '' };
    }
    return { ok: true, stdout: wantName && (opts.anyNames ?? []).includes(wantName) ? wantName : '' };
  };
  return { exec, calls };
}

test('write disabled ⇒ no docker action, status writeDisabled', async () => {
  const { exec, calls } = makeExec();
  const result = await prepareProvision(baseInput(), { writeEnabled: false, exec });
  assert.equal(result.status, 'writeDisabled');
  assert.equal(calls.length, 0);
  assert.deepEqual(result.resources, []);
});

test('invalid input is rejected before any docker action', async () => {
  const { exec, calls } = makeExec();
  const result = await prepareProvision(baseInput({ imageName: 'nginx' }), { writeEnabled: true, exec });
  assert.equal(result.status, 'invalid');
  assert.ok(result.errors?.some((e) => e.code === 'imageNotAllowed'));
  assert.equal(calls.length, 0);
});

test('valid plan creates managed network + volume with labels', async () => {
  const { exec, calls } = makeExec();
  const result = await prepareProvision(baseInput(), { writeEnabled: true, exec });
  assert.equal(result.status, 'ok');
  assert.deepEqual(
    result.resources.map((r) => `${r.kind}:${r.outcome}`),
    ['network:created', 'volume:created'],
  );

  const createCalls = calls.filter((c) => c[1] === 'create');
  const netCreate = createCalls.find((c) => c[0] === 'network');
  const volCreate = createCalls.find((c) => c[0] === 'volume');
  assert.ok(netCreate && netCreate.at(-1) === NETWORK_NAME);
  assert.ok(netCreate.includes('--label') && netCreate.includes('speakcore.managed=true'));
  assert.ok(volCreate && volCreate.at(-1) === VOLUME_NAME);
  assert.ok(volCreate.includes('speakcore.instanceId=clabc123def456'));

  assert.equal(result.rollbackPlan.length, 2);
});

test('existing managed resources ⇒ idempotent (exists, no create)', async () => {
  const { exec, calls } = makeExec({ managedNames: [NETWORK_NAME, VOLUME_NAME] });
  const result = await prepareProvision(baseInput(), { writeEnabled: true, exec });
  assert.equal(result.status, 'ok');
  assert.deepEqual(
    result.resources.map((r) => r.outcome),
    ['exists', 'exists'],
  );
  assert.equal(calls.filter((c) => c[1] === 'create').length, 0);
  assert.equal(result.rollbackPlan.length, 0);
});

test('name conflict with unmanaged resource ⇒ conflict, no create', async () => {
  const { exec, calls } = makeExec({ anyNames: [NETWORK_NAME] });
  const result = await prepareProvision(baseInput(), { writeEnabled: true, exec });
  assert.equal(result.status, 'conflict');
  assert.equal(result.resources[0].outcome, 'conflict');
  assert.equal(calls.some((c) => c[0] === 'network' && c[1] === 'create'), false);
});

test('result never contains secrets', async () => {
  const { exec } = makeExec();
  const result = await prepareProvision(baseInput(), { writeEnabled: true, exec });
  assert.ok(!/password|secret|token|admin/i.test(JSON.stringify(result)));
});

test('POST /docker/provision/prepare requires token and honours write flag', async () => {
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/provision/prepare`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`http://localhost:${port}/docker/provision/prepare`, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(baseInput()),
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { status: string };
    assert.equal(body.status, 'writeDisabled'); // Flag ist false ⇒ keine Docker-Aktion
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('docker-write sources contain no forbidden docker commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src');
  const sources = ['docker-write.ts', 'docker-cli.ts'].map((f) => readFileSync(join(srcDir, f), 'utf8'));
  const forbidden = [
    'docker run',
    'docker start',
    'docker stop',
    'docker rm',
    'volume rm',
    'network rm',
    'docker inspect',
    'docker exec',
    'docker cp',
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
