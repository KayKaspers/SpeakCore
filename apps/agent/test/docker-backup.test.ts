import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3VolumeBackupRequest } from '@speakcore/types';
import { backupTs3Volume, DEFAULT_BACKUP_IMAGE } from '../src/docker-backup';
import type { DockerExec } from '../src/docker-cli';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const VOLUME = 'speakcore-volume-ts3-clabc123def456';
const CONTAINER = 'speakcore-ts3-clabc123def456';
const BACKUP_DIR = '/var/lib/speakcore/backups';
const NOW = new Date('2026-07-02T10:00:00.000Z');

function validRequest(overrides: Partial<Ts3VolumeBackupRequest> = {}): Ts3VolumeBackupRequest {
  return {
    instanceId: INSTANCE,
    serverDisplayName: 'Demo',
    confirmBackupMayContainSensitiveData: true,
    confirmBackupStorageResponsibility: true,
    confirmContainerShouldBeStopped: true,
    typedConfirmation: 'CREATE BACKUP',
    ...overrides,
  };
}

/**
 * containerNames: managed Container mit instanceId vorhanden. managedVol: managed Volume vorhanden.
 * anyVol: gleichnamiges Volume beliebig vorhanden. imageAvailable: Backup-Image lokal vorhanden.
 * runOk: Ergebnis des Backup-`run`. probeOk: Availability-Probe.
 */
function makeExec(opts: {
  containerNames?: string[];
  managedVol?: boolean;
  anyVol?: boolean;
  imageAvailable?: boolean;
  runOk?: boolean;
  probeOk?: boolean;
} = {}) {
  const calls: string[][] = [];
  // Der Backup-`run` erhält ein optionales Timeout als 2. Argument – die Signatur akzeptiert es.
  const exec: DockerExec = async (args) => {
    calls.push(args);
    if (args[0] === 'run') return { ok: opts.runOk ?? true, stdout: '' };
    if (args[0] === 'image' && args[1] === 'ls') {
      return { ok: true, stdout: (opts.imageAvailable ?? true) ? 'sha256:deadbeef' : '' };
    }
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

const SHA256_HEX = 'a'.repeat(24) + 'b'.repeat(40); // 64 Hex-Zeichen (Dummy)

function baseOpts(exec: DockerExec, over: Partial<Parameters<typeof backupTs3Volume>[1]> = {}) {
  const metaWrites: Array<{ path: string; content: string }> = [];
  const shaCalls: string[] = [];
  const opts = {
    writeEnabled: true,
    exec,
    backupDir: BACKUP_DIR,
    backupImage: DEFAULT_BACKUP_IMAGE,
    ensureDir: async () => true,
    writeMetadata: async (path: string, content: string) => {
      metaWrites.push({ path, content });
      return true;
    },
    computeSha256: async (fileName: string) => {
      shaCalls.push(fileName);
      return SHA256_HEX;
    },
    now: NOW,
    ...over,
  };
  return { opts, metaWrites, shaCalls };
}

test('write disabled ⇒ no docker action, status writeDisabled', async () => {
  const { exec, calls } = makeExec();
  const { opts } = baseOpts(exec, { writeEnabled: false });
  const result = await backupTs3Volume(validRequest(), opts);
  assert.equal(result.status, 'writeDisabled');
  assert.equal(calls.length, 0);
});

test('invalid instanceId ⇒ no docker action', async () => {
  const { exec, calls } = makeExec();
  const { opts } = baseOpts(exec);
  const result = await backupTs3Volume(validRequest({ instanceId: 'bad id!' }), opts);
  assert.equal(result.status, 'invalid');
  assert.equal(calls.length, 0);
});

test('backup dir unavailable ⇒ backupDirUnavailable, no run', async () => {
  const { exec, calls } = makeExec({ managedVol: true });
  const { opts } = baseOpts(exec, { ensureDir: async () => false });
  const result = await backupTs3Volume(validRequest(), opts);
  assert.equal(result.status, 'backupDirUnavailable');
  assert.ok(!calls.some((c) => c[0] === 'run'), 'no run when backup dir unavailable');
});

test('container still exists ⇒ containerStillExists, no run', async () => {
  const { exec, calls } = makeExec({ containerNames: [CONTAINER], managedVol: true });
  const { opts } = baseOpts(exec);
  const result = await backupTs3Volume(validRequest(), opts);
  assert.equal(result.status, 'containerStillExists');
  assert.ok(!calls.some((c) => c[0] === 'run'), 'no run when a container still exists');
});

test('volume missing ⇒ volumeNotFound, no run', async () => {
  const { exec, calls } = makeExec();
  const { opts } = baseOpts(exec);
  const result = await backupTs3Volume(validRequest(), opts);
  assert.equal(result.status, 'volumeNotFound');
  assert.ok(!calls.some((c) => c[0] === 'run'));
});

test('unmanaged volume with same name ⇒ volumeNotManaged, no run', async () => {
  const { exec, calls } = makeExec({ managedVol: false, anyVol: true });
  const { opts } = baseOpts(exec);
  const result = await backupTs3Volume(validRequest(), opts);
  assert.equal(result.status, 'volumeNotManaged');
  assert.ok(!calls.some((c) => c[0] === 'run'));
});

test('missing confirmations ⇒ blocked, no run', async () => {
  const { exec, calls } = makeExec({ managedVol: true });
  const { opts } = baseOpts(exec);
  const result = await backupTs3Volume(
    validRequest({ confirmBackupStorageResponsibility: false }),
    opts,
  );
  assert.equal(result.status, 'blocked');
  assert.ok(!calls.some((c) => c[0] === 'run'));
});

test('typed confirmation mismatch ⇒ blocked, no run', async () => {
  const { exec, calls } = makeExec({ managedVol: true });
  const { opts } = baseOpts(exec);
  const result = await backupTs3Volume(validRequest({ typedConfirmation: 'nope' }), opts);
  assert.equal(result.status, 'blocked');
  assert.ok(!calls.some((c) => c[0] === 'run'));
});

test('image unavailable ⇒ imageUnavailable, no run (no uncontrolled pull)', async () => {
  const { exec, calls } = makeExec({ managedVol: true, imageAvailable: false });
  const { opts } = baseOpts(exec);
  const result = await backupTs3Volume(validRequest(), opts);
  assert.equal(result.status, 'imageUnavailable');
  assert.ok(!calls.some((c) => c[0] === 'run'));
});

test('valid ⇒ created; static read-only run args, server-side dir/image, metadata written', async () => {
  const { exec, calls } = makeExec({ managedVol: true });
  const { opts, metaWrites } = baseOpts(exec);
  const result = await backupTs3Volume(validRequest(), opts);
  assert.equal(result.status, 'created');
  assert.ok(result.backupFileName?.startsWith(`speakcore-backup-ts3-${INSTANCE}-`));
  assert.ok(result.backupFileName?.endsWith('.tar.gz'));

  const run = calls.find((c) => c[0] === 'run');
  assert.ok(run, 'a docker run call must exist');
  assert.ok(run!.includes('--rm'), 'ephemeral container');
  assert.ok(!run!.includes('--force') && !run!.includes('-f'), 'no force');
  // read-only source mount, exactly derived from instanceId (not from the client):
  assert.ok(run!.includes(`${VOLUME}:/data:ro`), 'source volume mounted read-only');
  assert.ok(!run!.includes(`${VOLUME}:/data`) || run!.includes(`${VOLUME}:/data:ro`));
  // server-side backup dir + allowlisted image, not taken from the request:
  assert.ok(run!.includes(`${BACKUP_DIR}:/backup`), 'server-side backup dir');
  assert.ok(run!.includes(DEFAULT_BACKUP_IMAGE), 'allowlisted backup image');
  // static tar into the mounted backup dir, source dir read-only:
  assert.ok(run!.includes('tar'));
  assert.ok(run!.includes(`/backup/${result.backupFileName}`));
  assert.ok(run!.includes('-C') && run!.includes('/data'));
  // 4 managed labels present:
  assert.ok(run!.includes('speakcore.managed=true'));
  assert.ok(run!.includes(`speakcore.instanceId=${INSTANCE}`));
  assert.ok(run!.includes('speakcore.service=backup'));
  // no other docker mutations:
  assert.ok(!calls.some((c) => c[0] === 'rm' || (c[0] === 'volume' && c[1] === 'rm')));
  assert.ok(!calls.some((c) => c[0] === 'network'));
  assert.ok(!calls.some((c) => c[0] === 'inspect' || c[0] === 'exec' || c[0] === 'logs'));

  // metadata written server-side, no secrets, references the backup file:
  assert.equal(metaWrites.length, 1);
  assert.ok(metaWrites[0].path.endsWith('.metadata.json'));
  const meta = JSON.parse(metaWrites[0].content) as Record<string, unknown>;
  assert.equal(meta.instanceId, INSTANCE);
  assert.equal(meta.backupFileName, result.backupFileName);
  // Feld `containsSecrets: "unknown"` ist erlaubt – aber keine echten Secret-Werte/Keys:
  assert.equal(meta.containsSecrets, 'unknown');
  assert.ok(!/password|serveradmin|TS3SERVERQUERY|encryptedPassword|bearer/i.test(metaWrites[0].content));
  assert.ok(!Object.keys(meta).some((k) => /credential|token/i.test(k)), 'no credential/token keys');
});

test('created backup gets checksum metadata + checksumSha256 in result (Step 034)', async () => {
  const { exec } = makeExec({ managedVol: true });
  const { opts, metaWrites, shaCalls } = baseOpts(exec);
  const result = await backupTs3Volume(validRequest(), opts);
  assert.equal(result.status, 'created');
  assert.equal(result.checksumSha256, SHA256_HEX);

  // Prüfsumme wird NUR über die erzeugte tar.gz berechnet – nie über andere Dateien.
  assert.deepEqual(shaCalls, [result.backupFileName]);

  const meta = JSON.parse(metaWrites[0].content) as {
    checksum?: { algorithm: string; value: string; createdAt: string };
  };
  assert.equal(meta.checksum?.algorithm, 'sha256');
  assert.equal(meta.checksum?.value, SHA256_HEX);
  assert.equal(meta.checksum?.createdAt, NOW.toISOString());

  // checksumCreated-Event geplant, aber der WERT steht nicht im Audit:
  const auditActions = result.audit.map((a) => a.action);
  assert.ok(auditActions.includes('backup.managedVolume.checksumCreated'));
  assert.ok(!JSON.stringify(result.audit).includes(SHA256_HEX), 'checksum value must not be in audit');
});

test('checksum computation failure ⇒ backup still created, metadata without checksum', async () => {
  const { exec } = makeExec({ managedVol: true });
  const { opts, metaWrites } = baseOpts(exec, { computeSha256: async () => null });
  const result = await backupTs3Volume(validRequest(), opts);
  assert.equal(result.status, 'created');
  assert.equal(result.checksumSha256, undefined);
  const meta = JSON.parse(metaWrites[0].content) as Record<string, unknown>;
  assert.ok(!('checksum' in meta), 'no checksum field when computation failed');
  assert.ok(!result.audit.some((a) => a.action === 'backup.managedVolume.checksumCreated'));
});

test('run failure ⇒ error', async () => {
  const { exec } = makeExec({ managedVol: true, runOk: false });
  const { opts } = baseOpts(exec);
  const result = await backupTs3Volume(validRequest(), opts);
  assert.equal(result.status, 'error');
});

test('metadata write failure ⇒ error', async () => {
  const { exec } = makeExec({ managedVol: true });
  const { opts } = baseOpts(exec, { writeMetadata: async () => false });
  const result = await backupTs3Volume(validRequest(), opts);
  assert.equal(result.status, 'error');
});

test('result never contains secrets or a host path', async () => {
  const { exec } = makeExec({ managedVol: true });
  const { opts } = baseOpts(exec);
  const result = await backupTs3Volume(validRequest(), opts);
  const s = JSON.stringify(result);
  assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s));
  assert.ok(!s.includes(BACKUP_DIR), 'result must not leak the host backup path');
});

test('POST /docker/provision/backup-volume requires token and honours write flag', async () => {
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/provision/backup-volume`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`http://localhost:${port}/docker/provision/backup-volume`, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(validRequest()),
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { status: string };
    assert.equal(body.status, 'writeDisabled'); // Flag false ⇒ keine Docker-Aktion
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('docker-backup sources allow run/tar but forbid other mutations/socket', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'docker-backup.ts'), 'utf8');
  // This module legitimately introduces the first `docker run` + `tar`; those are allowed here.
  const forbidden = [
    'volume rm',
    'network rm',
    'container rm',
    'docker rm',
    'rm -f',
    '--force',
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
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
  assert.ok(!src.includes('shell: true'), 'shell must not be enabled');
  // read-only source mount must be present, never a writable /data mount:
  assert.ok(src.includes(':/data:ro'), 'source volume must be mounted read-only');
});
