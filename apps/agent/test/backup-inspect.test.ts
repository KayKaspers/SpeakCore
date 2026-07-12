import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdtemp as mkdtempP, writeFile as writeFileP, symlink as symlinkP } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3BackupInspectRequest } from '@speakcore/types';
import {
  inspectBackup,
  instanceIdFromBackupFileName,
  type InspectBackupOptions,
} from '../src/backup-inspect';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const OTHER = 'clzzz999yyy888';
const TS = '2026-07-02T10-00-00-000Z';
const TAR = `speakcore-backup-ts3-${INSTANCE}-${TS}.tar.gz`;
const META = `speakcore-backup-ts3-${INSTANCE}-${TS}.metadata.json`;
const SHA = 'a'.repeat(64);
const MTIME = 1_700_000_000_000;

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
    checksum: { algorithm: 'sha256', value: SHA, createdAt: '2026-07-02T10:00:00.000Z' },
    containsSecrets: 'unknown',
    createdBy: 'owner',
    notes: [],
    ...overrides,
  };
}

function makeOpts(config: {
  lstat?: { isSymlink?: boolean; isFile?: boolean; sizeBytes?: number; mtimeMs?: number } | null;
  withinBoundary?: boolean;
  computed?: string | null;
  after?: { sizeBytes: number; mtimeMs: number } | null;
  metadataText?: string | null;
} = {}) {
  const calls = { compute: 0, meta: 0 };
  const opts: InspectBackupOptions = {
    withinBoundary: () => config.withinBoundary ?? true,
    lstatFile: async () =>
      config.lstat === null
        ? null
        : {
            isSymlink: config.lstat?.isSymlink ?? false,
            isFile: config.lstat?.isFile ?? true,
            sizeBytes: config.lstat?.sizeBytes ?? 1234,
            mtimeMs: config.lstat?.mtimeMs ?? MTIME,
          },
    computeSha256: async () => {
      calls.compute += 1;
      return config.computed === undefined ? SHA : config.computed;
    },
    statAfter: async () =>
      config.after === undefined
        ? { sizeBytes: config.lstat?.sizeBytes ?? 1234, mtimeMs: config.lstat?.mtimeMs ?? MTIME }
        : config.after,
    readMetadataFile: async () => {
      calls.meta += 1;
      return config.metadataText === undefined ? JSON.stringify(validMetadata()) : config.metadataText;
    },
  };
  return { opts, calls };
}

const req = (backupFileName: string): Ts3BackupInspectRequest => ({ backupFileName });

test('instanceIdFromBackupFileName parses id incl. hyphenated ids; rejects junk', () => {
  assert.equal(instanceIdFromBackupFileName(TAR), INSTANCE);
  assert.equal(
    instanceIdFromBackupFileName(`speakcore-backup-ts3-cl-a-b-c9-${TS}.tar.gz`),
    'cl-a-b-c9',
  );
  assert.equal(instanceIdFromBackupFileName('random.txt'), null);
  assert.equal(instanceIdFromBackupFileName(META), null);
});

test('valid managed backup + matching checksum ⇒ inspected but NOT restoreEligible (legacy, manifest missing)', async () => {
  const { opts } = makeOpts();
  const r = await inspectBackup(req(TAR), opts);
  assert.equal(r.managed, true);
  assert.equal(r.regularFile, true);
  assert.equal(r.sizeBytes, 1234);
  assert.equal(r.fingerprint?.value, SHA);
  assert.equal(r.fingerprint?.storedValue, SHA);
  assert.equal(r.fingerprint?.matchesStoredValue, true);
  assert.equal(r.metadata.status, 'valid');
  assert.equal(r.manifest.status, 'missing');
  assert.equal(r.legacy, true);
  assert.equal(r.restoreEligible, false);
  assert.ok(r.blockers.includes('RESTORE_MANIFEST_MISSING'));
  assert.equal(r.compatibility.status, 'incompatible');
  assert.deepEqual(r.snapshot, { sizeBytes: 1234, modifiedAt: r.modifiedAt, sha256: SHA });
});

test('name validation rejects traversal / absolute / separators / wrong extension / metadata.json ⇒ no fs access', async () => {
  for (const name of [
    `../${TAR}`,
    `/etc/${TAR}`,
    `C:\\${TAR}`,
    `sub/${TAR}`,
    `sub\\${TAR}`,
    `${TAR}.txt`,
    META,
    `speakcore-backup-ts3-${OTHER}-${TS}.tar.gz-extra.tar.gz`,
    '',
  ]) {
    const { opts, calls } = makeOpts();
    const r = await inspectBackup(req(name), opts);
    assert.equal(r.managed, false, `name: ${name}`);
    assert.ok(r.blockers.includes('BACKUP_NAME_INVALID'));
    assert.equal(r.restoreEligible, false);
    assert.equal(calls.compute, 0, 'no hashing for invalid names');
  }
});

test('non-object / missing backupFileName ⇒ BACKUP_NAME_INVALID', async () => {
  const { opts } = makeOpts();
  assert.ok((await inspectBackup(null as unknown as Ts3BackupInspectRequest, opts)).blockers.includes('BACKUP_NAME_INVALID'));
  assert.ok((await inspectBackup({} as Ts3BackupInspectRequest, opts)).blockers.includes('BACKUP_NAME_INVALID'));
});

test('boundary violation ⇒ BACKUP_OUTSIDE_MANAGED_BOUNDARY (no hashing)', async () => {
  const { opts, calls } = makeOpts({ withinBoundary: false });
  const r = await inspectBackup(req(TAR), opts);
  assert.ok(r.blockers.includes('BACKUP_OUTSIDE_MANAGED_BOUNDARY'));
  assert.equal(calls.compute, 0);
});

test('not found ⇒ BACKUP_NOT_FOUND; directory ⇒ BACKUP_NOT_REGULAR_FILE; symlink ⇒ BACKUP_LINK_REJECTED', async () => {
  assert.ok((await inspectBackup(req(TAR), makeOpts({ lstat: null }).opts)).blockers.includes('BACKUP_NOT_FOUND'));
  const dir = await inspectBackup(req(TAR), makeOpts({ lstat: { isFile: false } }).opts);
  assert.ok(dir.blockers.includes('BACKUP_NOT_REGULAR_FILE'));
  assert.equal(dir.regularFile, false);
  const link = await inspectBackup(req(TAR), makeOpts({ lstat: { isSymlink: true } }).opts);
  assert.ok(link.blockers.includes('BACKUP_LINK_REJECTED'));
});

test('empty archive ⇒ BACKUP_EMPTY (still inspected, not eligible)', async () => {
  const { opts } = makeOpts({ lstat: { sizeBytes: 0 }, after: { sizeBytes: 0, mtimeMs: MTIME } });
  const r = await inspectBackup(req(TAR), opts);
  assert.equal(r.regularFile, true);
  assert.ok(r.blockers.includes('BACKUP_EMPTY'));
  assert.equal(r.restoreEligible, false);
});

test('hash read failure ⇒ ARCHIVE_READ_FAILED', async () => {
  const r = await inspectBackup(req(TAR), makeOpts({ computed: null }).opts);
  assert.ok(r.blockers.includes('ARCHIVE_READ_FAILED'));
  assert.equal(r.fingerprint, null);
});

test('file changed during inspection ⇒ BACKUP_CHANGED_DURING_INSPECTION, result discarded (no fingerprint/snapshot)', async () => {
  const r = await inspectBackup(
    req(TAR),
    makeOpts({ after: { sizeBytes: 1234, mtimeMs: MTIME + 5 } }).opts,
  );
  assert.ok(r.blockers.includes('BACKUP_CHANGED_DURING_INSPECTION'));
  assert.equal(r.fingerprint, null);
  assert.equal(r.snapshot, null);
});

test('sidecar missing ⇒ METADATA_MISSING + ARCHIVE_CHECKSUM_MISSING', async () => {
  const r = await inspectBackup(req(TAR), makeOpts({ metadataText: null }).opts);
  assert.equal(r.metadata.status, 'missing');
  assert.ok(r.blockers.includes('METADATA_MISSING'));
  assert.ok(r.blockers.includes('ARCHIVE_CHECKSUM_MISSING'));
});

test('sidecar invalid JSON ⇒ METADATA_INVALID', async () => {
  const r = await inspectBackup(req(TAR), makeOpts({ metadataText: 'not-json{{' }).opts);
  assert.equal(r.metadata.status, 'invalid');
  assert.ok(r.blockers.includes('METADATA_INVALID'));
});

test('sidecar structurally invalid (wrong instanceId) ⇒ METADATA_INVALID', async () => {
  const r = await inspectBackup(
    req(TAR),
    makeOpts({ metadataText: JSON.stringify(validMetadata({ instanceId: OTHER })) }).opts,
  );
  assert.equal(r.metadata.status, 'invalid');
  assert.ok(r.blockers.includes('METADATA_INVALID'));
});

test('stored checksum matches ⇒ matchesStoredValue true; no ARCHIVE_CHECKSUM_MISMATCH', async () => {
  const r = await inspectBackup(req(TAR), makeOpts().opts);
  assert.equal(r.fingerprint?.matchesStoredValue, true);
  assert.ok(!r.blockers.includes('ARCHIVE_CHECKSUM_MISMATCH'));
});

test('stored checksum mismatch ⇒ ARCHIVE_CHECKSUM_MISMATCH, matchesStoredValue false', async () => {
  const meta = validMetadata({ checksum: { algorithm: 'sha256', value: 'b'.repeat(64), createdAt: 'x' } });
  const r = await inspectBackup(req(TAR), makeOpts({ metadataText: JSON.stringify(meta) }).opts);
  assert.equal(r.fingerprint?.matchesStoredValue, false);
  assert.ok(r.blockers.includes('ARCHIVE_CHECKSUM_MISMATCH'));
  assert.equal(r.restoreEligible, false);
});

test('metadata without checksum ⇒ ARCHIVE_CHECKSUM_MISSING (matchesStoredValue null)', async () => {
  const meta = validMetadata();
  delete meta.checksum;
  const r = await inspectBackup(req(TAR), makeOpts({ metadataText: JSON.stringify(meta) }).opts);
  assert.equal(r.metadata.status, 'valid');
  assert.equal(r.fingerprint?.storedValue, null);
  assert.equal(r.fingerprint?.matchesStoredValue, null);
  assert.ok(r.blockers.includes('ARCHIVE_CHECKSUM_MISSING'));
});

test('legacy contract for existing backups: legacy true, restoreEligible false, RESTORE_MANIFEST_MISSING', async () => {
  const r = await inspectBackup(req(TAR), makeOpts().opts);
  assert.equal(r.legacy, true);
  assert.equal(r.restoreEligible, false);
  assert.equal(r.manifest.status, 'missing');
  assert.equal(r.manifest.schemaVersion, null);
  assert.ok(r.blockers.includes('RESTORE_MANIFEST_MISSING'));
});

test('result contains no host paths and no secrets', async () => {
  const r = await inspectBackup(req(TAR), makeOpts().opts);
  const s = JSON.stringify(r);
  assert.ok(!/password|serveradmin|TS3SERVERQUERY|encryptedPassword|bearer /i.test(s));
  assert.ok(!s.includes('/var/lib') && !s.includes('"/') && !/[A-Za-z]:\\\\/.test(s));
});

test('POST /docker/provision/inspect-backup: auth gate + real streamed hash; file untouched, no extraction', async () => {
  const dir = await mkdtempP(join(tmpdir(), 'speakcore-inspect-'));
  const content = 'raw-tar-gz-bytes-' + 'x'.repeat(500);
  const realSha = createHash('sha256').update(content).digest('hex');
  await writeFileP(join(dir, TAR), content);
  await writeFileP(
    join(dir, META),
    JSON.stringify(validMetadata({ checksum: { algorithm: 'sha256', value: realSha, createdAt: 'x' } })),
  );
  await writeFileP(join(dir, 'unrelated.txt'), 'keep');

  const before = readdirSync(dir).sort();
  const beforeStat = statSync(join(dir, TAR));

  const prev = process.env.AGENT_BACKUP_DIR;
  process.env.AGENT_BACKUP_DIR = dir;
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  const url = `http://localhost:${port}/docker/provision/inspect-backup`;
  try {
    const denied = await fetch(url, { method: 'POST', body: '{}' });
    assert.equal(denied.status, 401);

    const ok = await fetch(url, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(req(TAR)),
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as {
      managed: boolean;
      regularFile: boolean;
      fingerprint: { value: string; matchesStoredValue: boolean };
      restoreEligible: boolean;
      legacy: boolean;
      blockers: string[];
    };
    assert.equal(body.managed, true);
    assert.equal(body.regularFile, true);
    assert.equal(body.fingerprint.value, realSha, 'streamed hash matches file');
    assert.equal(body.fingerprint.matchesStoredValue, true);
    assert.equal(body.legacy, true);
    assert.equal(body.restoreEligible, false);
    assert.ok(body.blockers.includes('RESTORE_MANIFEST_MISSING'));
    assert.ok(!JSON.stringify(body).includes(dir.replace(/\\/g, '\\\\')), 'no host path in response');

    // Inspection is strictly read-only: directory unchanged, archive not modified, nothing created.
    const afterStat = statSync(join(dir, TAR));
    assert.equal(afterStat.size, beforeStat.size);
    assert.equal(afterStat.mtimeMs, beforeStat.mtimeMs, 'archive not modified');
    assert.deepEqual(readdirSync(dir).sort(), before, 'inspection creates/removes no files');

    // symlink rejection (skip if the platform cannot create symlinks):
    const linkName = `speakcore-backup-ts3-${INSTANCE}-2026-01-01T00-00-00-000Z.tar.gz`;
    let linkOk = true;
    try {
      await symlinkP(join(dir, TAR), join(dir, linkName));
    } catch {
      linkOk = false;
      console.log('SKIP symlink test: platform cannot create symlinks');
    }
    if (linkOk) {
      const linkRes = await fetch(url, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify(req(linkName)),
      });
      const linkBody = (await linkRes.json()) as { blockers: string[] };
      assert.ok(linkBody.blockers.includes('BACKUP_LINK_REJECTED'));
    }
  } finally {
    if (prev === undefined) delete process.env.AGENT_BACKUP_DIR;
    else process.env.AGENT_BACKUP_DIR = prev;
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('backup-inspect source: no docker/exec/shell/extraction/listing/write', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'backup-inspect.ts'), 'utf8');
  const forbidden = [
    'execFile',
    'child_process',
    'spawn(',
    "'docker'",
    'docker run',
    'docker.sock',
    'shell',
    'tar -',
    'tar-stream',
    'gunzip',
    'unzip',
    'readdir',
    'createWriteStream',
    'writeFile',
    'unlink',
    'rmdir',
    'mkdir',
    'extract',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
});
