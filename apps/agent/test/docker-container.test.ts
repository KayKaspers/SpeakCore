import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3ContainerCreateRequest, Ts3ProvisionInput } from '@speakcore/types';
import { createTs3Container } from '../src/docker-container';
import type { DockerExec } from '../src/docker-cli';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const CONTAINER_NAME = 'speakcore-ts3-clabc123def456';
const VOLUME_NAME = 'speakcore-volume-ts3-clabc123def456';
const SECRET = 'S3cretQueryAdminPw0123456789abcd';

function baseInput(overrides: Partial<Ts3ProvisionInput> = {}): Ts3ProvisionInput {
  return {
    instanceId: INSTANCE,
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

function baseRequest(overrides: Partial<Ts3ContainerCreateRequest> = {}): Ts3ContainerCreateRequest {
  return {
    input: baseInput(),
    queryAdminUsername: 'serveradmin',
    queryAdminPassword: SECRET,
    ...overrides,
  };
}

function makeExec(opts: { managedNames?: string[]; anyNames?: string[]; createOk?: boolean } = {}) {
  const calls: string[][] = [];
  const exec: DockerExec = async (args) => {
    calls.push(args);
    if (args[0] === 'create') return { ok: opts.createOk ?? true, stdout: '' };
    // container ls ...
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

test('write disabled ⇒ no docker action, status writeDisabled, no secret', async () => {
  const { exec, calls } = makeExec();
  const result = await createTs3Container(baseRequest(), { writeEnabled: false, exec });
  assert.equal(result.status, 'writeDisabled');
  assert.equal(calls.length, 0);
  assert.ok(!JSON.stringify(result).includes(SECRET));
});

test('invalid input rejected before any docker action', async () => {
  const { exec, calls } = makeExec();
  const result = await createTs3Container(baseRequest({ input: baseInput({ imageName: 'nginx' }) }), {
    writeEnabled: true,
    exec,
  });
  assert.equal(result.status, 'invalid');
  assert.equal(calls.length, 0);
});

test('missing secret rejected before any docker action', async () => {
  const { exec, calls } = makeExec();
  const result = await createTs3Container(baseRequest({ queryAdminPassword: '' }), {
    writeEnabled: true,
    exec,
  });
  assert.equal(result.status, 'invalid');
  assert.ok(result.errors?.some((e) => e.code === 'secretMissing'));
  assert.equal(calls.length, 0);
});

test('valid plan creates (not runs/starts) container with labels, ports, volume, network, secret ENV', async () => {
  const { exec, calls } = makeExec();
  const result = await createTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'created');
  assert.equal(result.containerName, CONTAINER_NAME);

  const create = calls.find((c) => c[0] === 'create');
  assert.ok(create, 'a docker create call must exist');
  // Es ist `create`, NICHT run/start.
  assert.equal(create![0], 'create');
  assert.ok(!calls.some((c) => c[0] === 'run' || c[0] === 'start'), 'must never run/start');

  // Name / Netzwerk / Restart / Image (Image zuletzt).
  assert.ok(create!.includes('--name') && create!.includes(CONTAINER_NAME));
  assert.ok(create!.includes('--network') && create!.includes('speakcore-network-voice'));
  assert.ok(create!.includes('--restart') && create!.includes('unless-stopped'));
  assert.equal(create!.at(-1), 'teamspeak');

  // Labels.
  assert.ok(create!.includes('speakcore.managed=true'));
  assert.ok(create!.includes('speakcore.project=SpeakCore'));
  assert.ok(create!.includes(`speakcore.instanceId=${INSTANCE}`));
  assert.ok(create!.includes('speakcore.service=teamspeak3'));

  // Ports (voice udp, query tcp, filetransfer tcp).
  assert.ok(create!.includes('9987:9987/udp'));
  assert.ok(create!.includes('10011:10011/tcp'));
  assert.ok(create!.includes('30033:30033/tcp'));

  // Named Volume (kein Host-Pfad).
  assert.ok(create!.includes(`${VOLUME_NAME}:/var/ts3server`));
  assert.ok(!create!.some((a) => a.startsWith('/') && a.includes(':/')), 'no host bind mount');

  // Secret als ENV im create-Aufruf ...
  assert.ok(create!.includes(`TS3SERVERQUERY_ADMIN_PASSWORD=${SECRET}`));
});

test('secret appears only in the docker create args, never in the result', async () => {
  const { exec, calls } = makeExec();
  const result = await createTs3Container(baseRequest(), { writeEnabled: true, exec });
  const allCallArgs = calls.flat().join(' ');
  assert.ok(allCallArgs.includes(SECRET), 'secret must be passed to docker create (ENV)');
  assert.ok(!JSON.stringify(result).includes(SECRET), 'secret must NOT be in the result');
  assert.ok(!/password|serveradmin/i.test(JSON.stringify(result)));
});

test('existing managed container ⇒ idempotent (exists, no create)', async () => {
  const { exec, calls } = makeExec({ managedNames: [CONTAINER_NAME] });
  const result = await createTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'exists');
  assert.equal(result.containerName, CONTAINER_NAME);
  assert.equal(calls.some((c) => c[0] === 'create'), false);
});

test('unmanaged name conflict ⇒ conflict, no create, no takeover', async () => {
  const { exec, calls } = makeExec({ anyNames: [CONTAINER_NAME] });
  const result = await createTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'conflict');
  assert.equal(calls.some((c) => c[0] === 'create'), false);
});

test('docker unavailable ⇒ unavailable, no create', async () => {
  const calls: string[][] = [];
  const exec: DockerExec = async (args) => {
    calls.push(args);
    return { ok: false, stdout: '' }; // Probe schlägt fehl
  };
  const result = await createTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'unavailable');
  assert.equal(calls.some((c) => c[0] === 'create'), false);
});

test('create failure ⇒ error, no secret in result', async () => {
  const { exec } = makeExec({ createOk: false });
  const result = await createTs3Container(baseRequest(), { writeEnabled: true, exec });
  assert.equal(result.status, 'error');
  assert.ok(!JSON.stringify(result).includes(SECRET));
});

test('POST /docker/provision/create-container requires token and honours write flag', async () => {
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/provision/create-container`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`http://localhost:${port}/docker/provision/create-container`, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(baseRequest()),
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { status: string };
    assert.equal(body.status, 'writeDisabled'); // Flag false ⇒ keine Docker-Aktion
    assert.ok(!JSON.stringify(body).includes(SECRET));
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('docker-container sources contain no forbidden docker commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src');
  const sources = ['docker-container.ts', 'docker-cli.ts'].map((f) =>
    readFileSync(join(srcDir, f), 'utf8'),
  );
  const forbidden = [
    'docker run',
    'docker start',
    "'start'",
    'docker stop',
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
