import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { BackupListResult } from '@speakcore/types';
import {
  assertBackupListContainsNoSecrets,
  buildBackupListAuditEntries,
  formatBackupSize,
  shortChecksum,
} from '../src/core/backup-list-helpers';

const FILE = 'speakcore-backup-ts3-clabc123def456-2026-07-02T10-00-00-000Z.tar.gz';

function cleanResult(): BackupListResult {
  return {
    status: 'ok',
    backups: [
      {
        fileName: FILE,
        sizeBytes: 1234,
        createdAt: '2026-07-02T10:00:01.000Z',
        modifiedAt: '2026-07-02T10:00:02.000Z',
        metadataStatus: 'present',
        metadata: {
          backupVersion: 1,
          product: 'SpeakCore',
          kind: 'managed-ts3-volume-backup',
          createdAt: '2026-07-02T10:00:00.000Z',
          instanceId: 'clabc123def456',
          serverDisplayName: 'Demo',
          volumeName: 'speakcore-volume-ts3-clabc123def456',
          backupFileName: FILE,
          containsSecrets: 'unknown',
          createdBy: 'owner',
          notes: ['Backup may contain sensitive TeamSpeak server data.'],
        },
      },
    ],
  };
}

test('audit: completed ⇒ requested + completed', () => {
  const entries = buildBackupListAuditEntries('completed', 'owner@example.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.list.requested',
    'backup.managedVolume.list.completed',
  ]);
});

test('audit: failed ⇒ requested + failed (failure)', () => {
  const entries = buildBackupListAuditEntries('failed', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.list.requested',
    'backup.managedVolume.list.failed',
  ]);
  assert.equal(entries[1].result, 'failure');
});

test('audit never contains a file list, secrets or host paths', () => {
  for (const outcome of ['completed', 'failed'] as const) {
    const s = JSON.stringify(buildBackupListAuditEntries(outcome, 'o@e.com', 'srv-7'));
    assert.ok(!s.includes('.tar.gz'), 'no file names in audit');
    assert.ok(!s.includes('metadata'), 'no metadata payload in audit');
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s.replace(/backup\.managedVolume/g, '')));
    assert.ok(!s.includes('/var/'), 'no host paths in audit');
  }
});

test('assertBackupListContainsNoSecrets accepts a clean result (containsSecrets field allowed)', () => {
  assert.doesNotThrow(() => assertBackupListContainsNoSecrets(cleanResult()));
});

test('assertBackupListContainsNoSecrets rejects host-path values', () => {
  const bad = cleanResult();
  bad.backups![0].fileName = '/var/lib/speakcore/backups/' + FILE;
  assert.throws(() => assertBackupListContainsNoSecrets(bad), /host path/);

  const badWin = cleanResult();
  badWin.backups![0].metadata!.volumeName = 'C:\\backups\\volume';
  assert.throws(() => assertBackupListContainsNoSecrets(badWin), /host path/);
});

test('assertBackupListContainsNoSecrets rejects secret-like keys and values', () => {
  const badKey = cleanResult() as unknown as Record<string, unknown>;
  (badKey.backups as Array<Record<string, unknown>>)[0].queryPassword = 'x';
  assert.throws(() => assertBackupListContainsNoSecrets(badKey as unknown as BackupListResult), /forbidden key/);

  const badValue = cleanResult();
  badValue.backups![0].metadata!.notes = ['login serveradmin via query'];
  assert.throws(() => assertBackupListContainsNoSecrets(badValue), /secret-like value/);
});

test('checksum metadata passes the secret scan (hex is not a secret)', () => {
  const withChecksum = cleanResult();
  withChecksum.backups![0].metadata!.checksum = {
    algorithm: 'sha256',
    value: 'e'.repeat(64),
    createdAt: '2026-07-02T10:00:00.000Z',
  };
  assert.doesNotThrow(() => assertBackupListContainsNoSecrets(withChecksum));
});

test('shortChecksum truncates valid sha256 values and rejects garbage', () => {
  const value = '0123456789abcdef'.repeat(4); // 64 Hex-Zeichen
  assert.equal(shortChecksum(value), '0123456789ab…');
  assert.equal(shortChecksum('not-a-checksum'), '—');
  assert.equal(shortChecksum(''), '—');
});

test('formatBackupSize renders sensible units', () => {
  assert.equal(formatBackupSize(0), '0 B');
  assert.equal(formatBackupSize(512), '512 B');
  assert.equal(formatBackupSize(2048), '2.0 KB');
  assert.equal(formatBackupSize(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBackupSize(-1), '—');
});

test('backup-list sources contain no docker commands / no execFile / no delete / no socket', () => {
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
    'unlink',
    'rmdir',
    'createReadStream',
    'tar -',
  ];
  // Service strikt inkl. Socket; die Helfer enthalten 'docker.sock' NUR als Leak-Erkennungsmuster.
  const service = readFileSync(join(coreDir, 'backup-list.ts'), 'utf8');
  for (const token of [...forbidden, 'docker.sock']) {
    assert.ok(!service.includes(token), `forbidden token present in service: ${token}`);
  }
  const helpers = readFileSync(join(coreDir, 'backup-list-helpers.ts'), 'utf8');
  for (const token of forbidden) {
    assert.ok(!helpers.includes(token), `forbidden token present in helpers: ${token}`);
  }
});
