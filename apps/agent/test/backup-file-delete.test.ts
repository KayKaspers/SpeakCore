import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { mkdtemp as mkdtempP, mkdir as mkdirP, writeFile as writeFileP } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Ts3BackupDeleteRequest } from '@speakcore/types';
import { deleteTs3BackupFile, type DeleteBackupFileOptions } from '../src/backup-file-delete';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const OTHER_INSTANCE = 'clzzz999yyy888';
const TS = '2026-07-02T10-00-00-000Z';
const TAR = `speakcore-backup-ts3-${INSTANCE}-${TS}.tar.gz`;
const META = `speakcore-backup-ts3-${INSTANCE}-${TS}.metadata.json`;
const FOREIGN_TAR = `speakcore-backup-ts3-${OTHER_INSTANCE}-${TS}.tar.gz`;

function req(overrides: Partial<Ts3BackupDeleteRequest> = {}): Ts3BackupDeleteRequest {
  return {
    instanceId: INSTANCE,
    fileName: TAR,
    confirmBackupDeletion: true,
    confirmBackupMayBeOnlyCopy: true,
    confirmNoRestoreWithoutBackup: true,
    typedConfirmation: 'DELETE BACKUP',
    ...overrides,
  };
}

function makeOpts(config: { dirAvailable?: boolean; existing?: string[]; deleteOk?: boolean } = {}) {
  const existing = new Set(config.existing ?? [TAR, META]);
  const deletes: string[] = [];
  const opts: DeleteBackupFileOptions = {
    dirAvailable: async () => config.dirAvailable ?? true,
    fileExists: async (name) => existing.has(name),
    deleteFile: async (name) => {
      deletes.push(name);
      if (config.deleteOk === false) return false;
      existing.delete(name);
      return true;
    },
  };
  return { opts, deletes };
}

test('invalid instanceId/fileName/metadata.json/traversal/foreign ⇒ invalid, NO delete call', async () => {
  const cases: Array<Partial<Ts3BackupDeleteRequest>> = [
    { instanceId: 'bad id!' },
    { fileName: 'random.txt' },
    { fileName: META }, // metadata.json ist NIE primäres Ziel
    { fileName: `../${TAR}` },
    { fileName: `sub/${TAR}` },
    { fileName: `sub\\${TAR}` },
    { fileName: FOREIGN_TAR },
    { fileName: `${TAR}.extra` },
    { fileName: '' },
  ];
  for (const overrides of cases) {
    const { opts, deletes } = makeOpts();
    const result = await deleteTs3BackupFile(req(overrides), opts);
    assert.equal(result.status, 'invalid', JSON.stringify(overrides));
    assert.equal(deletes.length, 0);
  }
});

test('each missing confirmation and wrong typed confirmation ⇒ invalid, NO delete call', async () => {
  const cases: Array<Partial<Ts3BackupDeleteRequest>> = [
    { confirmBackupDeletion: false },
    { confirmBackupMayBeOnlyCopy: false },
    { confirmNoRestoreWithoutBackup: false },
    { confirmBackupDeletion: undefined },
    { typedConfirmation: 'delete backup' },
    { typedConfirmation: '' },
    { typedConfirmation: undefined },
  ];
  for (const overrides of cases) {
    const { opts, deletes } = makeOpts();
    const result = await deleteTs3BackupFile(req(overrides), opts);
    assert.equal(result.status, 'invalid', JSON.stringify(overrides));
    assert.equal(deletes.length, 0);
  }
});

test('backup dir unavailable ⇒ backupDirUnavailable, no delete', async () => {
  const { opts, deletes } = makeOpts({ dirAvailable: false });
  assert.equal((await deleteTs3BackupFile(req(), opts)).status, 'backupDirUnavailable');
  assert.equal(deletes.length, 0);
});

test('tar.gz already gone ⇒ alreadyRemoved; orphaned metadata.json is NOT auto-deleted', async () => {
  const { opts, deletes } = makeOpts({ existing: [META] });
  const result = await deleteTs3BackupFile(req(), opts);
  assert.equal(result.status, 'alreadyRemoved');
  assert.equal(deletes.length, 0, 'no cleanup without the primary target (documented)');
});

test('valid request deletes EXACTLY the tar.gz and its derived metadata.json', async () => {
  const { opts, deletes } = makeOpts();
  const result = await deleteTs3BackupFile(req(), opts);
  assert.equal(result.status, 'deleted');
  assert.equal(result.metadataRemoved, true);
  assert.deepEqual(deletes, [TAR, META], 'exactly two targeted unlinks, nothing else');
});

test('metadata absent ⇒ deleted with metadataRemoved false, single delete call', async () => {
  const { opts, deletes } = makeOpts({ existing: [TAR] });
  const result = await deleteTs3BackupFile(req(), opts);
  assert.equal(result.status, 'deleted');
  assert.equal(result.metadataRemoved, false);
  assert.deepEqual(deletes, [TAR]);
});

test('tar delete failure ⇒ error; metadata delete failure ⇒ metadataDeleteFailed', async () => {
  const tarFail = makeOpts({ deleteOk: false });
  assert.equal((await deleteTs3BackupFile(req(), tarFail.opts)).status, 'error');

  // tar löschbar, metadata-Löschung schlägt fehl:
  const existing = new Set([TAR, META]);
  const deletes: string[] = [];
  const opts: DeleteBackupFileOptions = {
    dirAvailable: async () => true,
    fileExists: async (name) => existing.has(name),
    deleteFile: async (name) => {
      deletes.push(name);
      if (name === META) return false;
      existing.delete(name);
      return true;
    },
  };
  const result = await deleteTs3BackupFile(req(), opts);
  assert.equal(result.status, 'metadataDeleteFailed');
  assert.equal(result.metadataRemoved, false);
});

test('result contains no host paths and no secrets', async () => {
  const { opts } = makeOpts();
  const s = JSON.stringify(await deleteTs3BackupFile(req(), opts));
  assert.ok(!/password|serveradmin|TS3SERVERQUERY|encryptedPassword|bearer /i.test(s));
  assert.ok(!s.includes('"/') && !s.includes('/var/lib') && !/[A-Za-z]:\\\\/.test(s));
});

test('POST /docker/provision/delete-backup: token gate + real delete leaves foreign files untouched', async () => {
  const dir = await mkdtempP(join(tmpdir(), 'speakcore-backup-delete-'));
  await writeFileP(join(dir, TAR), 'bytes');
  await writeFileP(join(dir, META), '{}');
  await writeFileP(join(dir, FOREIGN_TAR), 'foreign');
  await writeFileP(join(dir, 'unrelated.txt'), 'keep');
  await mkdirP(join(dir, 'subdir'));
  await writeFileP(join(dir, 'subdir', TAR), 'nested-keep');

  const prevDir = process.env.AGENT_BACKUP_DIR;
  process.env.AGENT_BACKUP_DIR = dir;
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  const url = `http://localhost:${port}/docker/provision/delete-backup`;
  try {
    const denied = await fetch(url, { method: 'POST', body: '{}' });
    assert.equal(denied.status, 401);

    const ok = await fetch(url, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(req()),
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { status: string; metadataRemoved?: boolean };
    assert.equal(body.status, 'deleted');
    assert.equal(body.metadataRemoved, true);

    // Genau tar.gz + metadata.json sind weg – alles andere unberührt:
    assert.equal(existsSync(join(dir, TAR)), false);
    assert.equal(existsSync(join(dir, META)), false);
    assert.equal(existsSync(join(dir, FOREIGN_TAR)), true, 'foreign instance file untouched');
    assert.equal(existsSync(join(dir, 'unrelated.txt')), true, 'unrelated file untouched');
    assert.equal(existsSync(join(dir, 'subdir', TAR)), true, 'subdirectory untouched (no recursion)');

    // Zweiter Aufruf ⇒ alreadyRemoved (idempotent):
    const again = await fetch(url, {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(req()),
    });
    assert.equal(((await again.json()) as { status: string }).status, 'alreadyRemoved');
  } finally {
    if (prevDir === undefined) delete process.env.AGENT_BACKUP_DIR;
    else process.env.AGENT_BACKUP_DIR = prevDir;
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('backup-file-delete source: no docker/exec/shell/socket, no recursion/wildcards/listing', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'backup-file-delete.ts'), 'utf8');
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
    'docker.sock',
    'shell',
    'rmdir',
    'readdir',
    'recursive',
    'rimraf',
    'glob',
    'readFile',
    'writeFile',
    'createReadStream',
    'tar -',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
});
