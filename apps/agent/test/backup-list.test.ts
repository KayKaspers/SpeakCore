import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp as mkdtempP, mkdir as mkdirP, writeFile as writeFileP } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3BackupListRequest } from '@speakcore/types';
import {
  backupFileRegex,
  listTs3VolumeBackups,
  sanitizeBackupMetadataForDisplay,
  type ListBackupsOptions,
} from '../src/backup-list';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const OTHER_INSTANCE = 'clzzz999yyy888';
const TS_A = '2026-07-01T08-00-00-000Z';
const TS_B = '2026-07-02T10-00-00-000Z';
const TAR_A = `speakcore-backup-ts3-${INSTANCE}-${TS_A}.tar.gz`;
const TAR_B = `speakcore-backup-ts3-${INSTANCE}-${TS_B}.tar.gz`;
const META_B = `speakcore-backup-ts3-${INSTANCE}-${TS_B}.metadata.json`;

function validMetadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    backupVersion: 1,
    product: 'SpeakCore',
    kind: 'managed-ts3-volume-backup',
    createdAt: '2026-07-02T10:00:00.000Z',
    instanceId: INSTANCE,
    serverDisplayName: 'Demo',
    volumeName: `speakcore-volume-ts3-${INSTANCE}`,
    backupFileName: TAR_B,
    containsSecrets: 'unknown',
    createdBy: 'owner',
    notes: ['Backup may contain sensitive TeamSpeak server data.'],
    ...overrides,
  };
}

function makeOpts(config: {
  entries?: Array<{ name: string; isFile: boolean }> | null;
  metadataByName?: Record<string, string>;
} = {}) {
  const readCalls: string[] = [];
  const statCalls: string[] = [];
  const opts: ListBackupsOptions = {
    // `entries: null` heißt explizit „Verzeichnis nicht verfügbar" – nicht mit `[]` verwechseln.
    listDir: async () => (config.entries === undefined ? [] : config.entries),
    statFile: async (name) => {
      statCalls.push(name);
      return { sizeBytes: 1234, createdAt: '2026-07-02T10:00:01.000Z', modifiedAt: '2026-07-02T10:00:02.000Z' };
    },
    readMetadataFile: async (name) => {
      readCalls.push(name);
      return config.metadataByName?.[name] ?? null;
    },
  };
  return { opts, readCalls, statCalls };
}

function req(overrides: Partial<Ts3BackupListRequest> = {}): Ts3BackupListRequest {
  return { instanceId: INSTANCE, ...overrides };
}

test('invalid instanceId ⇒ invalid, no directory access', async () => {
  let listed = false;
  const { opts } = makeOpts();
  const result = await listTs3VolumeBackups(req({ instanceId: 'bad id!' }), {
    ...opts,
    listDir: async () => {
      listed = true;
      return [];
    },
  });
  assert.equal(result.status, 'invalid');
  assert.equal(listed, false);
});

test('backup dir unavailable ⇒ backupDirUnavailable', async () => {
  const { opts } = makeOpts({ entries: null });
  const result = await listTs3VolumeBackups(req(), opts);
  assert.equal(result.status, 'backupDirUnavailable');
});

test('only exactly matching backup files are listed (no foreign/other/dir entries)', async () => {
  const { opts } = makeOpts({
    entries: [
      { name: TAR_A, isFile: true },
      { name: TAR_B, isFile: true },
      // fremde Instanz:
      { name: `speakcore-backup-ts3-${OTHER_INSTANCE}-${TS_B}.tar.gz`, isFile: true },
      // sonstige Dateien:
      { name: 'random.txt', isFile: true },
      { name: 'speakcore-backup-ts3-clabc123def456-notatimestamp.tar.gz', isFile: true },
      { name: META_B, isFile: true }, // metadata.json selbst ist kein Backup-Eintrag
      // Subdirectory / Symlink (isFile false) – nie traversieren/folgen:
      { name: 'subdir', isFile: false },
      { name: TAR_A + '.lnk', isFile: false },
    ],
  });
  const result = await listTs3VolumeBackups(req(), opts);
  assert.equal(result.status, 'ok');
  assert.deepEqual(
    result.backups?.map((b) => b.fileName),
    [TAR_B, TAR_A], // neueste zuerst
  );
});

test('tar.gz content is never read – metadata is read only as .metadata.json for matching files', async () => {
  const { opts, readCalls } = makeOpts({ entries: [{ name: TAR_B, isFile: true }] });
  await listTs3VolumeBackups(req(), opts);
  assert.deepEqual(readCalls, [META_B]);
  assert.ok(!readCalls.some((n) => n.endsWith('.tar.gz')), 'never read backup archive contents');
});

test('valid metadata ⇒ present, sanitized (unknown keys dropped)', async () => {
  const raw = validMetadata({ secretToken: 'MUST-NOT-LEAK', hostPath: '/var/lib/speakcore/backups' });
  const { opts } = makeOpts({
    entries: [{ name: TAR_B, isFile: true }],
    metadataByName: { [META_B]: JSON.stringify(raw) },
  });
  const result = await listTs3VolumeBackups(req(), opts);
  assert.equal(result.status, 'ok');
  const entry = result.backups?.[0];
  assert.equal(entry?.metadataStatus, 'present');
  assert.equal(entry?.metadata?.backupFileName, TAR_B);
  const s = JSON.stringify(result);
  assert.ok(!s.includes('MUST-NOT-LEAK'), 'unknown metadata keys must be dropped');
  assert.ok(!s.includes('/var/lib'), 'no host paths in response');
});

test('metadata with wrong instanceId ⇒ invalid (not displayed)', async () => {
  const { opts } = makeOpts({
    entries: [{ name: TAR_B, isFile: true }],
    metadataByName: { [META_B]: JSON.stringify(validMetadata({ instanceId: OTHER_INSTANCE })) },
  });
  const result = await listTs3VolumeBackups(req(), opts);
  assert.equal(result.backups?.[0]?.metadataStatus, 'invalid');
  assert.equal(result.backups?.[0]?.metadata, undefined);
});

test('metadata with wrong backupFileName ⇒ invalid', async () => {
  const { opts } = makeOpts({
    entries: [{ name: TAR_B, isFile: true }],
    metadataByName: { [META_B]: JSON.stringify(validMetadata({ backupFileName: TAR_A })) },
  });
  const result = await listTs3VolumeBackups(req(), opts);
  assert.equal(result.backups?.[0]?.metadataStatus, 'invalid');
});

test('unparseable metadata ⇒ invalid; missing metadata ⇒ missing', async () => {
  const { opts } = makeOpts({
    entries: [
      { name: TAR_A, isFile: true },
      { name: TAR_B, isFile: true },
    ],
    metadataByName: { [META_B]: 'not-json{{' },
  });
  const result = await listTs3VolumeBackups(req(), opts);
  const byName = new Map(result.backups?.map((b) => [b.fileName, b.metadataStatus]));
  assert.equal(byName.get(TAR_B), 'invalid');
  assert.equal(byName.get(TAR_A), 'missing');
});

test('result contains no secrets and no absolute host paths', async () => {
  const { opts } = makeOpts({
    entries: [{ name: TAR_B, isFile: true }],
    metadataByName: { [META_B]: JSON.stringify(validMetadata()) },
  });
  const result = await listTs3VolumeBackups(req(), opts);
  const s = JSON.stringify(result);
  assert.ok(!/password|serveradmin|TS3SERVERQUERY|encryptedPassword|bearer /i.test(s));
  assert.ok(!s.includes('"/'), 'no string values starting with an absolute path');
  assert.ok(!/[A-Za-z]:\\\\/.test(s), 'no windows host paths');
});

test('sanitizeBackupMetadataForDisplay rejects wrong types and wrong constants', () => {
  const expected = { instanceId: INSTANCE, backupFileName: TAR_B };
  assert.equal(sanitizeBackupMetadataForDisplay(null, expected), null);
  assert.equal(sanitizeBackupMetadataForDisplay([], expected), null);
  assert.equal(sanitizeBackupMetadataForDisplay(validMetadata({ product: 'Other' }), expected), null);
  assert.equal(sanitizeBackupMetadataForDisplay(validMetadata({ kind: 'other-kind' }), expected), null);
  assert.equal(sanitizeBackupMetadataForDisplay(validMetadata({ backupVersion: 'x' }), expected), null);
  assert.equal(sanitizeBackupMetadataForDisplay(validMetadata({ containsSecrets: 'none' }), expected), null);
  assert.equal(sanitizeBackupMetadataForDisplay(validMetadata({ notes: [1, 2] }), expected), null);
  assert.ok(sanitizeBackupMetadataForDisplay(validMetadata(), expected));
});

test('backupFileRegex matches only the strict step-032 pattern', () => {
  const re = backupFileRegex(INSTANCE);
  assert.ok(re.test(TAR_B));
  assert.ok(!re.test(`speakcore-backup-ts3-${INSTANCE}-${TS_B}.tar.gz.extra`));
  assert.ok(!re.test(`speakcore-backup-ts3-${INSTANCE}-evil-${TS_B}.tar.gz`));
  assert.ok(!re.test(`speakcore-backup-ts3-${OTHER_INSTANCE}-${TS_B}.tar.gz`));
  assert.ok(!re.test(`../speakcore-backup-ts3-${INSTANCE}-${TS_B}.tar.gz`));
});

test('POST /docker/provision/list-backups requires token; works read-only against a real temp dir', async () => {
  // Realer Temp-Ordner mit passenden/fremden Dateien + Subdirectory (kein Docker, kein Write-Flag nötig).
  const dir = await mkdtempP(join(tmpdir(), 'speakcore-backup-list-'));
  await writeFileP(join(dir, TAR_B), 'dummy-not-read');
  await writeFileP(join(dir, META_B), JSON.stringify(validMetadata()));
  await writeFileP(join(dir, 'unrelated.txt'), 'nope');
  await mkdirP(join(dir, 'subdir'));
  await writeFileP(join(dir, 'subdir', TAR_A), 'must-not-be-listed');

  const prevDir = process.env.AGENT_BACKUP_DIR;
  process.env.AGENT_BACKUP_DIR = dir;
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/provision/list-backups`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`http://localhost:${port}/docker/provision/list-backups`, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(req()),
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as {
      status: string;
      backups?: Array<{ fileName: string; metadataStatus: string }>;
    };
    // Write-Flag ist false – read-only Listing funktioniert trotzdem (kein Docker-Write nötig).
    assert.equal(body.status, 'ok');
    assert.deepEqual(body.backups?.map((b) => b.fileName), [TAR_B]); // Subdir/unrelated nie gelistet
    assert.equal(body.backups?.[0]?.metadataStatus, 'present');
    assert.ok(!JSON.stringify(body).includes(dir.replace(/\\/g, '\\\\')), 'no host path in response');
  } finally {
    if (prevDir === undefined) delete process.env.AGENT_BACKUP_DIR;
    else process.env.AGENT_BACKUP_DIR = prevDir;
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('backup-list source contains no docker/exec/shell/socket usage', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'backup-list.ts'), 'utf8');
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
    'tar -',
    'unlink',
    'rmdir',
    'writeFile',
    'createReadStream',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
});
