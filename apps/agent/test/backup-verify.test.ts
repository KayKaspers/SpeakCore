import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp as mkdtempP, writeFile as writeFileP } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3BackupVerifyRequest } from '@speakcore/types';
import {
  isValidBackupFileName,
  verifyTs3VolumeBackup,
  type VerifyBackupOptions,
} from '../src/backup-verify';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const OTHER_INSTANCE = 'clzzz999yyy888';
const TS = '2026-07-02T10-00-00-000Z';
const TAR = `speakcore-backup-ts3-${INSTANCE}-${TS}.tar.gz`;
const META = `speakcore-backup-ts3-${INSTANCE}-${TS}.metadata.json`;
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const NOW = new Date('2026-07-02T12:00:00.000Z');

function validMetadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    backupVersion: 1,
    product: 'SpeakCore',
    kind: 'managed-ts3-volume-backup',
    createdAt: '2026-07-02T10:00:00.000Z',
    instanceId: INSTANCE,
    serverDisplayName: 'Demo',
    volumeName: `speakcore-volume-ts3-${INSTANCE}`,
    backupFileName: TAR,
    checksum: { algorithm: 'sha256', value: SHA_A, createdAt: '2026-07-02T10:00:00.000Z' },
    containsSecrets: 'unknown',
    createdBy: 'owner',
    notes: [],
    ...overrides,
  };
}

function makeOpts(config: {
  dirAvailable?: boolean;
  fileExists?: boolean;
  metadataText?: string | null;
  computed?: string | null;
} = {}) {
  const shaCalls: string[] = [];
  const opts: VerifyBackupOptions = {
    dirAvailable: async () => config.dirAvailable ?? true,
    fileExists: async () => config.fileExists ?? true,
    readMetadataFile: async () => (config.metadataText === undefined ? null : config.metadataText),
    computeSha256: async (name) => {
      shaCalls.push(name);
      return config.computed === undefined ? SHA_A : config.computed;
    },
    now: NOW,
  };
  return { opts, shaCalls };
}

function req(overrides: Partial<Ts3BackupVerifyRequest> = {}): Ts3BackupVerifyRequest {
  return { instanceId: INSTANCE, fileName: TAR, ...overrides };
}

test('invalid instanceId ⇒ invalid, no file access', async () => {
  const { opts, shaCalls } = makeOpts();
  const result = await verifyTs3VolumeBackup(req({ instanceId: 'bad id!' }), opts);
  assert.equal(result.status, 'invalid');
  assert.equal(shaCalls.length, 0);
});

test('invalid/foreign/traversal fileName ⇒ invalid, no file access', async () => {
  const badNames = [
    'random.txt',
    `speakcore-backup-ts3-${OTHER_INSTANCE}-${TS}.tar.gz`, // fremde Instanz
    `../${TAR}`,
    `sub/${TAR}`,
    `sub\\${TAR}`,
    `speakcore-backup-ts3-${INSTANCE}-notatimestamp.tar.gz`,
    `${TAR}.extra`,
    '',
  ];
  for (const fileName of badNames) {
    const { opts, shaCalls } = makeOpts();
    const result = await verifyTs3VolumeBackup(req({ fileName }), opts);
    assert.equal(result.status, 'invalid', `fileName: ${fileName}`);
    assert.equal(shaCalls.length, 0);
  }
});

test('isValidBackupFileName rejects non-strings and path fragments', () => {
  assert.equal(isValidBackupFileName(INSTANCE, TAR), true);
  assert.equal(isValidBackupFileName(INSTANCE, 42), false);
  assert.equal(isValidBackupFileName(INSTANCE, null), false);
  assert.equal(isValidBackupFileName(INSTANCE, `..\\${TAR}`), false);
});

test('backup dir unavailable ⇒ backupDirUnavailable', async () => {
  const { opts } = makeOpts({ dirAvailable: false });
  const result = await verifyTs3VolumeBackup(req(), opts);
  assert.equal(result.status, 'backupDirUnavailable');
});

test('backup file missing ⇒ backupNotFound', async () => {
  const { opts } = makeOpts({ fileExists: false });
  const result = await verifyTs3VolumeBackup(req(), opts);
  assert.equal(result.status, 'backupNotFound');
});

test('metadata missing ⇒ metadataMissing (no hash computed)', async () => {
  const { opts, shaCalls } = makeOpts({ metadataText: null });
  const result = await verifyTs3VolumeBackup(req(), opts);
  assert.equal(result.status, 'metadataMissing');
  assert.equal(shaCalls.length, 0);
});

test('metadata invalid (unparseable / wrong instanceId) ⇒ metadataInvalid', async () => {
  for (const text of [
    'not-json{{',
    JSON.stringify(validMetadata({ instanceId: OTHER_INSTANCE })),
    JSON.stringify(validMetadata({ backupFileName: 'other.tar.gz' })),
  ]) {
    const { opts, shaCalls } = makeOpts({ metadataText: text });
    const result = await verifyTs3VolumeBackup(req(), opts);
    assert.equal(result.status, 'metadataInvalid');
    assert.equal(shaCalls.length, 0);
  }
});

test('metadata without checksum ⇒ checksumMissing (Step-032-Backups; kein Nachrüsten)', async () => {
  const meta = validMetadata();
  delete meta.checksum;
  const { opts, shaCalls } = makeOpts({ metadataText: JSON.stringify(meta) });
  const result = await verifyTs3VolumeBackup(req(), opts);
  assert.equal(result.status, 'checksumMissing');
  assert.equal(shaCalls.length, 0, 'no hash computed without an expected checksum');
});

test('matching checksum ⇒ valid with both values + verifiedAt', async () => {
  const { opts, shaCalls } = makeOpts({ metadataText: JSON.stringify(validMetadata()), computed: SHA_A });
  const result = await verifyTs3VolumeBackup(req(), opts);
  assert.equal(result.status, 'valid');
  assert.equal(result.fileName, TAR);
  assert.equal(result.algorithm, 'sha256');
  assert.equal(result.checksumSha256, SHA_A);
  assert.equal(result.metadataChecksumSha256, SHA_A);
  assert.equal(result.verifiedAt, NOW.toISOString());
  assert.deepEqual(shaCalls, [TAR], 'hash only over the requested tar.gz');
});

test('non-matching checksum ⇒ mismatch with both values', async () => {
  const { opts } = makeOpts({ metadataText: JSON.stringify(validMetadata()), computed: SHA_B });
  const result = await verifyTs3VolumeBackup(req(), opts);
  assert.equal(result.status, 'mismatch');
  assert.equal(result.checksumSha256, SHA_B);
  assert.equal(result.metadataChecksumSha256, SHA_A);
});

test('hash computation failure ⇒ error', async () => {
  const { opts } = makeOpts({ metadataText: JSON.stringify(validMetadata()), computed: null });
  const result = await verifyTs3VolumeBackup(req(), opts);
  assert.equal(result.status, 'error');
});

test('result contains no host paths and no secrets', async () => {
  const { opts } = makeOpts({ metadataText: JSON.stringify(validMetadata()), computed: SHA_B });
  const result = await verifyTs3VolumeBackup(req(), opts);
  const s = JSON.stringify(result);
  assert.ok(!/password|serveradmin|TS3SERVERQUERY|encryptedPassword|bearer /i.test(s));
  assert.ok(!s.includes('"/') && !s.includes('/var/lib'), 'no host paths');
  assert.ok(!/[A-Za-z]:\\\\/.test(s), 'no windows host paths');
});

test('POST /docker/provision/verify-backup requires token; valid + mismatch against a real temp dir', async () => {
  const dir = await mkdtempP(join(tmpdir(), 'speakcore-backup-verify-'));
  const content = 'dummy-backup-bytes-not-unpacked';
  const realSha = createHash('sha256').update(content).digest('hex');
  await writeFileP(join(dir, TAR), content);
  await writeFileP(
    join(dir, META),
    JSON.stringify(validMetadata({ checksum: { algorithm: 'sha256', value: realSha, createdAt: 'x' } })),
  );

  const prevDir = process.env.AGENT_BACKUP_DIR;
  process.env.AGENT_BACKUP_DIR = dir;
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/provision/verify-backup`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`http://localhost:${port}/docker/provision/verify-backup`, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(req()),
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { status: string; checksumSha256?: string };
    // Read-only Verify funktioniert OHNE Write-Flag (dockerWriteEnabled: false):
    assert.equal(body.status, 'valid');
    assert.equal(body.checksumSha256, realSha);

    // Metadaten manipulieren ⇒ mismatch:
    await writeFileP(
      join(dir, META),
      JSON.stringify(validMetadata({ checksum: { algorithm: 'sha256', value: SHA_B, createdAt: 'x' } })),
    );
    const bad = await fetch(`http://localhost:${port}/docker/provision/verify-backup`, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(req()),
    });
    const badBody = (await bad.json()) as { status: string; metadataChecksumSha256?: string };
    assert.equal(badBody.status, 'mismatch');
    assert.equal(badBody.metadataChecksumSha256, SHA_B);
    assert.ok(!JSON.stringify(badBody).includes(dir.replace(/\\/g, '\\\\')), 'no host path in response');
  } finally {
    if (prevDir === undefined) delete process.env.AGENT_BACKUP_DIR;
    else process.env.AGENT_BACKUP_DIR = prevDir;
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('backup-verify source contains no docker/exec/shell/socket and no write operations', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'backup-verify.ts'), 'utf8');
  const forbidden = [
    'execFile',
    'child_process',
    'spawn(',
    'exec(',
    "'docker'",
    'docker run',
    'docker rm',
    'volume rm',
    'network rm',
    'docker inspect',
    'docker logs',
    'docker.sock',
    'shell',
    'writeFile',
    'writeMetadata',
    'mkdir',
    'unlink',
    'rmdir',
    'rename',
    'createReadStream',
    'tar -',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
});
