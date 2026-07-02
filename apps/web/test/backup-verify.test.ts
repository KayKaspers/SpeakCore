import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildBackupVerifyAuditEntries,
  isSafeBackupFileName,
} from '../src/core/backup-verify-helpers';

const FILE = 'speakcore-backup-ts3-clabc123def456-2026-07-02T10-00-00-000Z.tar.gz';

test('audit: completed ⇒ requested + completed', () => {
  const entries = buildBackupVerifyAuditEntries('completed', 'owner@example.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.verify.requested',
    'backup.managedVolume.verify.completed',
  ]);
});

test('audit: mismatch ⇒ requested + mismatch (failure) + completed', () => {
  const entries = buildBackupVerifyAuditEntries('mismatch', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.verify.requested',
    'backup.managedVolume.verify.mismatch',
    'backup.managedVolume.verify.completed',
  ]);
  assert.equal(entries[1].result, 'failure');
});

test('audit: failed ⇒ requested + failed (failure)', () => {
  const entries = buildBackupVerifyAuditEntries('failed', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.verify.requested',
    'backup.managedVolume.verify.failed',
  ]);
  assert.equal(entries[1].result, 'failure');
});

test('audit never contains file names, checksums, secrets or host paths', () => {
  for (const outcome of ['completed', 'mismatch', 'failed'] as const) {
    const s = JSON.stringify(buildBackupVerifyAuditEntries(outcome, 'o@e.com', 'srv-7'));
    assert.ok(!s.includes('.tar.gz'), 'no file names in audit');
    assert.ok(!/[0-9a-f]{64}/.test(s), 'no checksum values in audit');
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s.replace(/backup\.managedVolume/g, '')));
    assert.ok(!s.includes('/var/'), 'no host paths in audit');
  }
});

test('isSafeBackupFileName accepts the backup pattern and rejects path fragments', () => {
  assert.equal(isSafeBackupFileName(FILE), true);
  assert.equal(isSafeBackupFileName('random.txt'), false);
  assert.equal(isSafeBackupFileName(`../${FILE}`), false);
  assert.equal(isSafeBackupFileName(`sub/${FILE}`), false);
  assert.equal(isSafeBackupFileName(`sub\\${FILE}`), false);
  assert.equal(isSafeBackupFileName('speakcore-backup-ts3-x.tar.gz.txt'), false);
  assert.equal(isSafeBackupFileName(''), false);
  assert.equal(isSafeBackupFileName(42), false);
  assert.equal(isSafeBackupFileName('a'.repeat(300) + '.tar.gz'), false);
});

test('backup-verify sources contain no docker/execFile/write/delete/socket usage', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const forbidden = [
    'execFile',
    'child_process',
    'docker run',
    'docker rm',
    'volume rm',
    'network rm',
    'docker inspect',
    'docker logs',
    'docker.sock',
    'writeFile',
    'unlink',
    'rmdir',
    'createReadStream',
    'tar -',
  ];
  for (const file of ['backup-verify.ts', 'backup-verify-helpers.ts']) {
    const src = readFileSync(join(coreDir, file), 'utf8');
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token present in ${file}: ${token}`);
    }
  }
});
