import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildBackupDownloadAuditEntries,
  mapDownloadConfirmations,
} from '../src/core/backup-download-helpers';
import { BACKUP_DOWNLOAD_RATE_LIMIT } from '../src/core/rate-limit-policy';

const FULL = {
  confirmBackupContainsSensitiveData: true,
  confirmSecureStorageResponsibility: true,
  typedConfirmation: 'DOWNLOAD BACKUP',
};

test('confirmations: all set + exact phrase ⇒ ok', () => {
  assert.equal(mapDownloadConfirmations(FULL), 'ok');
});

test('confirmations: missing sensitive-data confirmation blocks', () => {
  assert.equal(
    mapDownloadConfirmations({ ...FULL, confirmBackupContainsSensitiveData: false }),
    'sensitiveDataRequired',
  );
  assert.equal(mapDownloadConfirmations({}), 'sensitiveDataRequired');
});

test('confirmations: missing storage confirmation blocks', () => {
  assert.equal(
    mapDownloadConfirmations({ ...FULL, confirmSecureStorageResponsibility: false }),
    'storageRequired',
  );
});

test('confirmations: typed phrase is REQUIRED and must match exactly (no defaults)', () => {
  assert.equal(mapDownloadConfirmations({ ...FULL, typedConfirmation: undefined }), 'typedMismatch');
  assert.equal(mapDownloadConfirmations({ ...FULL, typedConfirmation: '' }), 'typedMismatch');
  assert.equal(mapDownloadConfirmations({ ...FULL, typedConfirmation: 'download backup' }), 'typedMismatch');
});

test('rate-limit policy: 5 per hour (Step-036 blueprint)', () => {
  assert.equal(BACKUP_DOWNLOAD_RATE_LIMIT.max, 5);
  assert.equal(BACKUP_DOWNLOAD_RATE_LIMIT.windowMs, 60 * 60 * 1000);
});

test('audit: blocked ⇒ requested + blocked (no confirmed)', () => {
  const entries = buildBackupDownloadAuditEntries('blocked', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.download.requested',
    'backup.managedVolume.download.blocked',
  ]);
  assert.equal(entries[1].result, 'failure');
});

test('audit: verifyBlocked ⇒ requested + confirmed + blocked', () => {
  const entries = buildBackupDownloadAuditEntries('verifyBlocked', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.download.requested',
    'backup.managedVolume.download.confirmed',
    'backup.managedVolume.download.blocked',
  ]);
});

test('audit: started ⇒ requested + confirmed + started (last reliable point, no completed)', () => {
  const entries = buildBackupDownloadAuditEntries('started', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.download.requested',
    'backup.managedVolume.download.confirmed',
    'backup.managedVolume.download.started',
  ]);
  assert.ok(!entries.some((e) => e.action.endsWith('.completed')), 'completed is never claimed');
});

test('audit: failed ⇒ requested + confirmed + failed', () => {
  const entries = buildBackupDownloadAuditEntries('failed', 'o@e.com', 'srv-7');
  assert.deepEqual(entries.map((e) => e.action), [
    'backup.managedVolume.download.requested',
    'backup.managedVolume.download.confirmed',
    'backup.managedVolume.download.failed',
  ]);
  assert.equal(entries[2].result, 'failure');
});

test('audit never contains file names, checksums, secrets or host paths', () => {
  for (const outcome of ['blocked', 'verifyBlocked', 'started', 'failed'] as const) {
    const s = JSON.stringify(buildBackupDownloadAuditEntries(outcome, 'o@e.com', 'srv-7'));
    assert.ok(!s.includes('.tar.gz'), 'no file names in audit');
    assert.ok(!/[0-9a-f]{64}/.test(s), 'no checksum values in audit');
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s.replace(/backup\.managedVolume/g, '')));
    assert.ok(!s.includes('/var/'), 'no host paths in audit');
  }
});

test('backup-download web sources: no docker/execFile/fs, agent token/url never exposed to client', () => {
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
    'createReadStream',
    'readFileSync',
    'node:fs',
    'tar -',
  ];
  for (const file of ['backup-download.ts', 'backup-download-helpers.ts']) {
    const src = readFileSync(join(coreDir, file), 'utf8');
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token present in ${file}: ${token}`);
    }
    assert.ok(!src.includes('NEXT_PUBLIC'), 'nothing client-exposed');
  }

  // Route Handler: streamt nur durch – kennt weder AGENT_URL noch Token direkt, kein fs, kein Buffering.
  const route = readFileSync(
    join(here, '..', 'src', 'app', '[locale]', 'servers', '[id]', 'backups', 'download', 'route.ts'),
    'utf8',
  );
  for (const token of ['AGENT_URL', 'AGENT_BOOTSTRAP_TOKEN', 'NEXT_PUBLIC', 'node:fs', 'arrayBuffer(', 'Buffer.concat']) {
    assert.ok(!route.includes(token), `forbidden token present in route.ts: ${token}`);
  }
});
