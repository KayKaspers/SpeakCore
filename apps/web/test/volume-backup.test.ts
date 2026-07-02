import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildVolumeBackupAuditEntries,
  mapBackupConfirmationGuard,
} from '../src/core/volume-backup-helpers';

const FULL = {
  confirmBackupMayContainSensitiveData: true,
  confirmBackupStorageResponsibility: true,
  confirmContainerShouldBeStopped: true,
  typedConfirmation: 'CREATE BACKUP',
};

test('confirmation guard: all confirmations + exact phrase ⇒ ok', () => {
  assert.equal(mapBackupConfirmationGuard(FULL), 'ok');
});

test('confirmation guard: missing sensitive-data confirmation blocks', () => {
  assert.equal(
    mapBackupConfirmationGuard({ ...FULL, confirmBackupMayContainSensitiveData: false }),
    'sensitiveDataRequired',
  );
});

test('confirmation guard: missing storage confirmation blocks', () => {
  assert.equal(
    mapBackupConfirmationGuard({ ...FULL, confirmBackupStorageResponsibility: false }),
    'storageRequired',
  );
});

test('confirmation guard: missing container-stopped confirmation blocks', () => {
  assert.equal(
    mapBackupConfirmationGuard({ ...FULL, confirmContainerShouldBeStopped: false }),
    'containerStoppedRequired',
  );
});

test('confirmation guard: wrong/empty typed phrase blocks (typedMismatch)', () => {
  assert.equal(mapBackupConfirmationGuard({ ...FULL, typedConfirmation: 'create backup' }), 'typedMismatch');
  assert.equal(mapBackupConfirmationGuard({ ...FULL, typedConfirmation: '' }), 'typedMismatch');
});

test('audit: created ⇒ requested + confirmed + started + completed', () => {
  const actions = buildVolumeBackupAuditEntries('created', 'owner@example.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, [
    'backup.managedVolume.requested',
    'backup.managedVolume.confirmed',
    'backup.managedVolume.started',
    'backup.managedVolume.completed',
  ]);
});

test('audit: created with checksum ⇒ appends checksumCreated event WITHOUT the value (Step 034)', () => {
  const entries = buildVolumeBackupAuditEntries('created', 'o@e.com', 'srv-7', true);
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.requested',
    'backup.managedVolume.confirmed',
    'backup.managedVolume.started',
    'backup.managedVolume.completed',
    'backup.managedVolume.checksumCreated',
  ]);
  // Nur das Ereignis – kein Hex-Wert, kein Dateiname im Audit:
  const s = JSON.stringify(entries);
  assert.ok(!/[0-9a-f]{64}/.test(s), 'no checksum value in audit');
  assert.ok(!s.includes('.tar.gz'));
});

test('audit: withChecksum has no effect on non-created outcomes', () => {
  const entries = buildVolumeBackupAuditEntries('failed', 'o@e.com', 'srv-7', true);
  assert.ok(!entries.some((e) => e.action === 'backup.managedVolume.checksumCreated'));
});

test('audit: web-side block ⇒ requested + blocked (no confirmed)', () => {
  const entries = buildVolumeBackupAuditEntries('blocked', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.requested',
    'backup.managedVolume.blocked',
  ]);
  assert.equal(entries[1].result, 'failure');
});

test('audit: agent-side block ⇒ requested + confirmed + blocked', () => {
  const actions = buildVolumeBackupAuditEntries('agentBlocked', 'o@e.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, [
    'backup.managedVolume.requested',
    'backup.managedVolume.confirmed',
    'backup.managedVolume.blocked',
  ]);
});

test('audit: failed ⇒ requested + confirmed + started + failed', () => {
  const entries = buildVolumeBackupAuditEntries('failed', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.requested',
    'backup.managedVolume.confirmed',
    'backup.managedVolume.started',
    'backup.managedVolume.failed',
  ]);
  assert.equal(entries[3].result, 'failure');
});

test('audit entries never contain secrets or backup content', () => {
  for (const outcome of ['blocked', 'agentBlocked', 'created', 'failed'] as const) {
    const s = JSON.stringify(buildVolumeBackupAuditEntries(outcome, 'o@e.com', 'srv-7'));
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY|\.tar\.gz/i.test(s));
  }
});

test('volume-backup sources contain no docker commands / no force / no socket', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = ['volume-backup.ts', 'volume-backup-helpers.ts'].map((f) =>
    readFileSync(join(coreDir, f), 'utf8'),
  );
  const forbidden = [
    'volume rm',
    'network rm',
    'docker rm',
    'rm -f',
    '--force',
    'docker run',
    'docker logs',
    'docker inspect',
    'execFile',
    'docker.sock',
  ];
  for (const src of sources) {
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token present: ${token}`);
    }
  }
});
