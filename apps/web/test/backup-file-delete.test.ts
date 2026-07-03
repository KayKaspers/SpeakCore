import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildBackupFileDeleteAuditEntries,
  mapDeleteConfirmations,
} from '../src/core/backup-file-delete-helpers';
import { BACKUP_DELETE_RATE_LIMIT } from '../src/core/rate-limit-policy';

const FULL = {
  confirmBackupDeletion: true,
  confirmBackupMayBeOnlyCopy: true,
  confirmNoRestoreWithoutBackup: true,
  typedConfirmation: 'DELETE BACKUP',
};

test('confirmations: all set + exact phrase ⇒ ok; each missing one blocks', () => {
  assert.equal(mapDeleteConfirmations(FULL), 'ok');
  assert.equal(mapDeleteConfirmations({}), 'deletionRequired');
  assert.equal(
    mapDeleteConfirmations({ ...FULL, confirmBackupMayBeOnlyCopy: false }),
    'onlyCopyRequired',
  );
  assert.equal(
    mapDeleteConfirmations({ ...FULL, confirmNoRestoreWithoutBackup: false }),
    'restoreWarnRequired',
  );
});

test('confirmations: typed phrase is REQUIRED and must match exactly (no defaults)', () => {
  assert.equal(mapDeleteConfirmations({ ...FULL, typedConfirmation: undefined }), 'typedMismatch');
  assert.equal(mapDeleteConfirmations({ ...FULL, typedConfirmation: '' }), 'typedMismatch');
  assert.equal(mapDeleteConfirmations({ ...FULL, typedConfirmation: 'delete backup' }), 'typedMismatch');
});

test('rate-limit policy: 5 delete actions per hour', () => {
  assert.equal(BACKUP_DELETE_RATE_LIMIT.max, 5);
  assert.equal(BACKUP_DELETE_RATE_LIMIT.windowMs, 60 * 60 * 1000);
});

test('audit: blocked ⇒ requested + blocked (no confirmed)', () => {
  const entries = buildBackupFileDeleteAuditEntries('blocked', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.delete.requested',
    'backup.managedVolume.delete.blocked',
  ]);
  assert.equal(entries[1].result, 'failure');
});

test('audit: agentBlocked ⇒ requested + confirmed + blocked', () => {
  const entries = buildBackupFileDeleteAuditEntries('agentBlocked', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.delete.requested',
    'backup.managedVolume.delete.confirmed',
    'backup.managedVolume.delete.blocked',
  ]);
});

test('audit: completed ⇒ requested + confirmed + started + completed', () => {
  const entries = buildBackupFileDeleteAuditEntries('completed', 'owner@example.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.delete.requested',
    'backup.managedVolume.delete.confirmed',
    'backup.managedVolume.delete.started',
    'backup.managedVolume.delete.completed',
  ]);
});

test('audit: alreadyRemoved ⇒ idempotent completed WITHOUT started', () => {
  const entries = buildBackupFileDeleteAuditEntries('alreadyRemoved', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.delete.requested',
    'backup.managedVolume.delete.confirmed',
    'backup.managedVolume.delete.completed',
  ]);
});

test('audit: failed ⇒ requested + confirmed + started + failed', () => {
  const entries = buildBackupFileDeleteAuditEntries('failed', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.delete.requested',
    'backup.managedVolume.delete.confirmed',
    'backup.managedVolume.delete.started',
    'backup.managedVolume.delete.failed',
  ]);
  assert.equal(entries[3].result, 'failure');
});

test('audit never contains file names, checksums, secrets or host paths', () => {
  for (const outcome of ['blocked', 'agentBlocked', 'completed', 'alreadyRemoved', 'failed'] as const) {
    const s = JSON.stringify(buildBackupFileDeleteAuditEntries(outcome, 'o@e.com', 'srv-7'));
    assert.ok(!s.includes('.tar.gz'), 'no file names in audit');
    assert.ok(!/[0-9a-f]{64}/.test(s), 'no checksum values in audit');
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s.replace(/backup\.managedVolume/g, '')));
    assert.ok(!s.includes('/var/'), 'no host paths in audit');
  }
});

test('backup-file-delete web sources: no fs/docker/execFile, no recursion/wildcards', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const forbidden = [
    'execFile',
    'child_process',
    'docker run',
    'docker rm',
    'volume rm',
    'network rm',
    'docker.sock',
    'node:fs',
    'unlink',
    'rmdir',
    'readdir',
    'recursive',
    'createReadStream',
    'tar -',
    'NEXT_PUBLIC',
  ];
  for (const file of ['backup-file-delete.ts', 'backup-file-delete-helpers.ts']) {
    const src = readFileSync(join(coreDir, file), 'utf8');
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token present in ${file}: ${token}`);
    }
  }
});
