import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { BackupListEntry } from '@speakcore/types';
import {
  DEFAULT_BACKUP_ROTATION_POLICY,
  buildRotationPreview,
  mapBackupListEntryToRotationEntry,
} from '../src/core/backup-rotation-preview';

const INSTANCE = 'clabc123def456';
const NOW = new Date('2026-07-02T12:00:00.000Z');

function listEntry(daysOld: number, withMetadata = true): BackupListEntry {
  const createdAt = new Date(NOW.getTime() - daysOld * 24 * 60 * 60 * 1000).toISOString();
  const ts = createdAt.replace(/[:.]/g, '-');
  const fileName = `speakcore-backup-ts3-${INSTANCE}-${ts}.tar.gz`;
  return {
    fileName,
    sizeBytes: 1234,
    // Datei-Zeitstempel bewusst abweichend, um die Metadata-Präferenz zu testen:
    createdAt: new Date(NOW.getTime() - (daysOld + 1) * 24 * 60 * 60 * 1000).toISOString(),
    modifiedAt: createdAt,
    metadataStatus: withMetadata ? 'present' : 'missing',
    ...(withMetadata
      ? {
          metadata: {
            backupVersion: 1,
            product: 'SpeakCore' as const,
            kind: 'managed-ts3-volume-backup' as const,
            createdAt,
            instanceId: INSTANCE,
            serverDisplayName: 'Demo',
            volumeName: `speakcore-volume-ts3-${INSTANCE}`,
            backupFileName: fileName,
            containsSecrets: 'unknown' as const,
            createdBy: 'owner',
            notes: [],
          },
        }
      : {}),
  };
}

test('mapper prefers metadata.createdAt, falls back to file timestamp, verified always false', () => {
  const withMeta = listEntry(10, true);
  const mapped = mapBackupListEntryToRotationEntry(withMeta);
  assert.equal(mapped.createdAt, withMeta.metadata?.createdAt);
  assert.equal(mapped.verified, false, 'conservative: no persistent verify state');

  const withoutMeta = listEntry(10, false);
  assert.equal(mapBackupListEntryToRotationEntry(withoutMeta).createdAt, withoutMeta.createdAt);
});

test('preview uses buildBackupRotationPlan with the default policy: newest 3 kept, old ones candidates', () => {
  const backups = [listEntry(1), listEntry(10), listEntry(30), listEntry(100), listEntry(200)];
  const preview = buildRotationPreview(backups, NOW);
  assert.equal(preview.dryRun, true);
  assert.equal(preview.executable, false);
  assert.equal(preview.deleteCandidates.length, 2);
  assert.equal(preview.kept.length, 3);
  assert.ok(preview.kept.every((k) => k.protectedBy.includes('keepLastCount')));
});

test('minimum age protects young backups beyond keepLastCount', () => {
  // 4 junge Backups (alle < 7 Tage): keepLastCount schützt 3, keepMinAgeDays das vierte.
  const backups = [listEntry(1), listEntry(2), listEntry(3), listEntry(4)];
  const preview = buildRotationPreview(backups, NOW);
  assert.equal(preview.deleteCandidates.length, 0);
  const fourth = preview.kept.find((k) => k.protectedBy.includes('keepMinAgeDays'));
  assert.ok(fourth, 'young backup protected by minimum age');
});

test('single backup is protected as onlyBackup', () => {
  const preview = buildRotationPreview([listEntry(500)], NOW);
  assert.equal(preview.deleteCandidates.length, 0);
  assert.ok(preview.kept[0].protectedBy.includes('onlyBackup'));
});

test('empty list ⇒ empty preview, still dryRun/non-executable', () => {
  const preview = buildRotationPreview([], NOW);
  assert.deepEqual(preview.deleteCandidates, []);
  assert.deepEqual(preview.kept, []);
  assert.equal(preview.dryRun, true);
  assert.equal(preview.executable, false);
});

test('default policy stays a pure dry-run config', () => {
  assert.equal(DEFAULT_BACKUP_ROTATION_POLICY.dryRun, true);
  assert.equal(DEFAULT_BACKUP_ROTATION_POLICY.keepLastCount, 3);
  assert.equal(DEFAULT_BACKUP_ROTATION_POLICY.keepMinAgeDays, 7);
  assert.equal(DEFAULT_BACKUP_ROTATION_POLICY.protectOnlyBackup, true);
  assert.equal(DEFAULT_BACKUP_ROTATION_POLICY.protectLastVerifiedBackup, true);
});

test('preview contains no secrets and no host paths', () => {
  const s = JSON.stringify(buildRotationPreview([listEntry(1), listEntry(100)], NOW));
  assert.ok(!/password|serveradmin|TS3SERVERQUERY|encryptedPassword|bearer /i.test(s));
  assert.ok(!s.includes('/var/lib') && !/[A-Za-z]:\\\\/.test(s), 'no host paths');
});

test('rotation-preview source: pure – no fs/agent/db/docker/exec/scheduler', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    join(here, '..', 'src', 'core', 'backup-rotation-preview.ts'),
    'utf8',
  );
  const forbidden = [
    'node:fs',
    'child_process',
    'unlink',
    'rmdir',
    'readdir',
    'readFile',
    'writeFile',
    'execFile',
    'fetch(',
    'prisma',
    'agent-client',
    'logAudit',
    "'docker'",
    'docker run',
    'docker.sock',
    'setInterval',
    'setTimeout',
    'NEXT_PUBLIC',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
});
