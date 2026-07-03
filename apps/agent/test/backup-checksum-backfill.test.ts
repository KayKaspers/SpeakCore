import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp as mkdtempP, readFile as readFileP, writeFile as writeFileP } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3BackupChecksumBackfillRequest } from '@speakcore/types';
import {
  backfillBackupChecksum,
  type BackfillChecksumOptions,
} from '../src/backup-checksum-backfill';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const OTHER_INSTANCE = 'clzzz999yyy888';
const TS = '2026-07-02T10-00-00-000Z';
const TAR = `speakcore-backup-ts3-${INSTANCE}-${TS}.tar.gz`;
const META = `speakcore-backup-ts3-${INSTANCE}-${TS}.metadata.json`;
const SHA = 'f'.repeat(64);
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
  writeOk?: boolean;
} = {}) {
  const writes: Array<{ name: string; content: string }> = [];
  const shaCalls: string[] = [];
  const opts: BackfillChecksumOptions = {
    dirAvailable: async () => config.dirAvailable ?? true,
    fileExists: async () => config.fileExists ?? true,
    readMetadataFile: async () => (config.metadataText === undefined ? null : config.metadataText),
    computeSha256: async (name) => {
      shaCalls.push(name);
      return config.computed === undefined ? SHA : config.computed;
    },
    writeMetadataFile: async (name, content) => {
      writes.push({ name, content });
      return config.writeOk ?? true;
    },
    now: NOW,
  };
  return { opts, writes, shaCalls };
}

function req(
  overrides: Partial<Ts3BackupChecksumBackfillRequest> = {},
): Ts3BackupChecksumBackfillRequest {
  return { instanceId: INSTANCE, fileName: TAR, confirmChecksumBackfill: true, ...overrides };
}

test('invalid instanceId / fileName / missing confirmation ⇒ invalid, no file access', async () => {
  const cases: Array<Partial<Ts3BackupChecksumBackfillRequest>> = [
    { instanceId: 'bad id!' },
    { fileName: 'random.txt' },
    { fileName: META }, // metadata.json ist kein Backup
    { fileName: `../${TAR}` },
    { fileName: `sub/${TAR}` },
    { fileName: `sub\\${TAR}` },
    { fileName: `speakcore-backup-ts3-${OTHER_INSTANCE}-${TS}.tar.gz` },
    { confirmChecksumBackfill: false },
    { confirmChecksumBackfill: undefined },
  ];
  for (const overrides of cases) {
    const { opts, writes, shaCalls } = makeOpts();
    const result = await backfillBackupChecksum(req(overrides), opts);
    assert.equal(result.status, 'invalid', JSON.stringify(overrides));
    assert.equal(writes.length, 0);
    assert.equal(shaCalls.length, 0);
  }
});

test('backup dir unavailable ⇒ backupDirUnavailable', async () => {
  const { opts } = makeOpts({ dirAvailable: false });
  assert.equal((await backfillBackupChecksum(req(), opts)).status, 'backupDirUnavailable');
});

test('backup missing ⇒ backupNotFound; metadata missing ⇒ metadataMissing (no write)', async () => {
  const missing = makeOpts({ fileExists: false });
  assert.equal((await backfillBackupChecksum(req(), missing.opts)).status, 'backupNotFound');

  const noMeta = makeOpts({ metadataText: null });
  assert.equal((await backfillBackupChecksum(req(), noMeta.opts)).status, 'metadataMissing');
  assert.equal(noMeta.writes.length, 0);
});

test('invalid metadata (unparseable / wrong instanceId) ⇒ metadataInvalid, no write', async () => {
  for (const text of ['not-json{{', JSON.stringify(validMetadata({ instanceId: OTHER_INSTANCE }))]) {
    const { opts, writes } = makeOpts({ metadataText: text });
    assert.equal((await backfillBackupChecksum(req(), opts)).status, 'metadataInvalid');
    assert.equal(writes.length, 0);
  }
});

test('checksum already present ⇒ alreadyPresent, NO write, NO hash', async () => {
  const withChecksum = validMetadata({
    checksum: { algorithm: 'sha256', value: SHA, createdAt: 'x' },
  });
  const { opts, writes, shaCalls } = makeOpts({ metadataText: JSON.stringify(withChecksum) });
  const result = await backfillBackupChecksum(req(), opts);
  assert.equal(result.status, 'alreadyPresent');
  assert.equal(writes.length, 0, 'existing checksum is never overwritten');
  assert.equal(shaCalls.length, 0);
});

test('missing checksum ⇒ updated: normalized write with checksum, unknown/secret fields dropped', async () => {
  const raw = validMetadata({
    injectedSecretToken: 'MUST-NOT-SURVIVE',
    hostPath: '/var/lib/speakcore/backups',
  });
  const { opts, writes, shaCalls } = makeOpts({ metadataText: JSON.stringify(raw) });
  const result = await backfillBackupChecksum(req(), opts);
  assert.equal(result.status, 'updated');
  assert.deepEqual(shaCalls, [TAR], 'hash only over the tar.gz');

  assert.equal(writes.length, 1);
  assert.equal(writes[0].name, META, 'only the metadata file is written');
  const written = JSON.parse(writes[0].content) as Record<string, unknown>;
  const checksum = written.checksum as { algorithm: string; value: string; createdAt: string };
  assert.equal(checksum.algorithm, 'sha256');
  assert.equal(checksum.value, SHA);
  assert.equal(checksum.createdAt, NOW.toISOString());
  assert.equal(written.instanceId, INSTANCE);
  assert.equal(written.backupFileName, TAR);
  // Kein Blind-Merge: eingeschleuste Felder überleben das normalisierte Schreiben nicht.
  assert.ok(!writes[0].content.includes('MUST-NOT-SURVIVE'));
  assert.ok(!writes[0].content.includes('/var/lib'));
});

test('hash failure ⇒ error (no write); write failure ⇒ error', async () => {
  const noHash = makeOpts({ metadataText: JSON.stringify(validMetadata()), computed: null });
  assert.equal((await backfillBackupChecksum(req(), noHash.opts)).status, 'error');
  assert.equal(noHash.writes.length, 0);

  const noWrite = makeOpts({ metadataText: JSON.stringify(validMetadata()), writeOk: false });
  assert.equal((await backfillBackupChecksum(req(), noWrite.opts)).status, 'error');
});

test('result contains no host paths and no secrets', async () => {
  const { opts } = makeOpts({ metadataText: JSON.stringify(validMetadata()) });
  const result = await backfillBackupChecksum(req(), opts);
  const s = JSON.stringify(result);
  assert.ok(!/password|serveradmin|TS3SERVERQUERY|encryptedPassword|bearer /i.test(s));
  assert.ok(!s.includes('"/') && !s.includes('/var/lib'));
});

test('POST /docker/provision/backfill-backup-checksum: token gate + real backfill, tar.gz untouched', async () => {
  const dir = await mkdtempP(join(tmpdir(), 'speakcore-backfill-'));
  const content = 'legacy-step-032-backup-bytes';
  const realSha = createHash('sha256').update(content).digest('hex');
  await writeFileP(join(dir, TAR), content);
  await writeFileP(join(dir, META), JSON.stringify(validMetadata()));

  const prevDir = process.env.AGENT_BACKUP_DIR;
  process.env.AGENT_BACKUP_DIR = dir;
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  const url = `http://localhost:${port}/docker/provision/backfill-backup-checksum`;
  try {
    const denied = await fetch(url, { method: 'POST', body: '{}' });
    assert.equal(denied.status, 401);

    // Echter Backfill (kein Docker-Write-Flag nötig):
    const ok = await fetch(url, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(req()),
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { status: string };
    assert.equal(body.status, 'updated');

    // tar.gz ist byte-identisch geblieben; metadata.json enthält die echte SHA-256:
    assert.equal(await readFileP(join(dir, TAR), 'utf8'), content);
    const meta = JSON.parse(await readFileP(join(dir, META), 'utf8')) as {
      checksum?: { algorithm: string; value: string };
    };
    assert.equal(meta.checksum?.algorithm, 'sha256');
    assert.equal(meta.checksum?.value, realSha);

    // Zweiter Aufruf ⇒ alreadyPresent (idempotent, kein Überschreiben):
    const again = await fetch(url, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(req()),
    });
    assert.equal(((await again.json()) as { status: string }).status, 'alreadyPresent');
  } finally {
    if (prevDir === undefined) delete process.env.AGENT_BACKUP_DIR;
    else process.env.AGENT_BACKUP_DIR = prevDir;
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('backfill source: no docker/exec/shell/socket, no delete/stream/unpack, no listing', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'backup-checksum-backfill.ts'), 'utf8');
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
    'unlink',
    'rmdir',
    'rename',
    'readdir',
    'createReadStream',
    'tar -',
    'gunzip',
    'unzip',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
});
