import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildChecksumBackfillAuditEntries } from '../src/core/backup-backfill-helpers';

test('audit: completed ⇒ requested + completed', () => {
  const entries = buildChecksumBackfillAuditEntries('completed', 'owner@example.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.checksumBackfill.requested',
    'backup.managedVolume.checksumBackfill.completed',
  ]);
});

test('audit: alreadyPresent ⇒ requested + alreadyPresent (no failure)', () => {
  const entries = buildChecksumBackfillAuditEntries('alreadyPresent', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.checksumBackfill.requested',
    'backup.managedVolume.checksumBackfill.alreadyPresent',
  ]);
  assert.ok(entries.every((e) => e.result !== 'failure'));
});

test('audit: failed ⇒ requested + failed (failure)', () => {
  const entries = buildChecksumBackfillAuditEntries('failed', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.checksumBackfill.requested',
    'backup.managedVolume.checksumBackfill.failed',
  ]);
  assert.equal(entries[1].result, 'failure');
});

test('audit never contains file names, checksums, secrets or host paths', () => {
  for (const outcome of ['completed', 'alreadyPresent', 'failed'] as const) {
    const s = JSON.stringify(buildChecksumBackfillAuditEntries(outcome, 'o@e.com', 'srv-7'));
    assert.ok(!s.includes('.tar.gz'), 'no file names in audit');
    assert.ok(!/[0-9a-f]{64}/.test(s), 'no checksum values in audit');
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s.replace(/backup\.managedVolume/g, '')));
    assert.ok(!s.includes('/var/'), 'no host paths in audit');
  }
});

test('backup-backfill web sources: no docker/execFile/fs/delete usage', () => {
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
    'createReadStream',
    'unlink',
    'rmdir',
    'tar -',
    'NEXT_PUBLIC',
  ];
  for (const file of ['backup-backfill.ts', 'backup-backfill-helpers.ts']) {
    const src = readFileSync(join(coreDir, file), 'utf8');
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token present in ${file}: ${token}`);
    }
  }
});
