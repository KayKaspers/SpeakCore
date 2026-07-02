import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { BackupDownloadConfirmations, BackupDownloadState } from '@speakcore/types';
import {
  BACKUP_DOWNLOAD_AUDIT,
  BACKUP_DOWNLOAD_TYPED_CONFIRMATION,
  BACKUP_DOWNLOAD_WARN_AT_BYTES,
  buildBackupDownloadPlan,
  canDownloadManagedBackup,
  isDownloadableBackupFileName,
  validateBackupDownloadRequest,
} from '../src/provisioning';

const INSTANCE = 'clabc123def456';
const OTHER_INSTANCE = 'clzzz999yyy888';
const FILE = `speakcore-backup-ts3-${INSTANCE}-2026-07-02T10-00-00-000Z.tar.gz`;

function baseState(overrides: Partial<BackupDownloadState> = {}): BackupDownloadState {
  return {
    mode: 'managed',
    instanceId: INSTANCE,
    archived: false,
    actorRole: 'OWNER',
    fileName: FILE,
    backupExists: true,
    metadataStatus: 'present',
    checksumPresent: true,
    verifyStatus: 'valid',
    sizeBytes: 123_456,
    rateLimited: false,
    ...overrides,
  };
}

const FULL: BackupDownloadConfirmations = {
  confirmBackupContainsSensitiveData: true,
  confirmSecureStorageResponsibility: true,
  typedConfirmation: 'DOWNLOAD BACKUP',
};

test('external server blocked', () => {
  const g = canDownloadManagedBackup(baseState({ mode: 'external' }), FULL);
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('notManaged'));
});

test('non-owner blocked', () => {
  const g = canDownloadManagedBackup(baseState({ actorRole: 'USER' }), FULL);
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('ownerRequired'));
});

test('invalid/foreign/traversal fileName blocked', () => {
  for (const fileName of [
    'random.txt',
    `speakcore-backup-ts3-${OTHER_INSTANCE}-2026-07-02T10-00-00-000Z.tar.gz`,
    `../${FILE}`,
    `sub/${FILE}`,
    `sub\\${FILE}`,
    `${FILE}.extra`,
  ]) {
    const g = canDownloadManagedBackup(baseState({ fileName }), FULL);
    assert.equal(g.allowed, false, `fileName: ${fileName}`);
    assert.ok(g.blockedReasons.includes('fileNameInvalid'));
  }
  assert.equal(isDownloadableBackupFileName(INSTANCE, FILE), true);
  assert.equal(isDownloadableBackupFileName(INSTANCE, 42), false);
});

test('backup missing / metadata missing / metadata invalid blocked', () => {
  assert.ok(
    canDownloadManagedBackup(baseState({ backupExists: false }), FULL).blockedReasons.includes('backupNotFound'),
  );
  assert.ok(
    canDownloadManagedBackup(baseState({ metadataStatus: 'missing' }), FULL).blockedReasons.includes(
      'metadataMissing',
    ),
  );
  assert.ok(
    canDownloadManagedBackup(baseState({ metadataStatus: 'invalid' }), FULL).blockedReasons.includes(
      'metadataInvalid',
    ),
  );
});

test('checksum missing blocked (hard rule)', () => {
  const g = canDownloadManagedBackup(
    baseState({ checksumPresent: false, verifyStatus: 'checksumMissing' }),
    FULL,
  );
  assert.equal(g.allowed, false);
  assert.deepEqual(
    g.blockedReasons.filter((r) => r === 'checksumMissing'),
    ['checksumMissing'],
    'checksumMissing deduped',
  );
});

test('verify missing blocked (verifyRequired), mismatch blocked (verifyMismatch)', () => {
  const notVerified = canDownloadManagedBackup(baseState({ verifyStatus: 'notVerified' }), FULL);
  assert.equal(notVerified.allowed, false);
  assert.ok(notVerified.blockedReasons.includes('verifyRequired'));

  const mismatch = canDownloadManagedBackup(baseState({ verifyStatus: 'mismatch' }), FULL);
  assert.equal(mismatch.allowed, false);
  assert.ok(mismatch.blockedReasons.includes('verifyMismatch'));
});

test('rate-limited blocked', () => {
  const g = canDownloadManagedBackup(baseState({ rateLimited: true }), FULL);
  assert.ok(g.blockedReasons.includes('rateLimited'));
});

test('verify valid but confirmations missing ⇒ blocked with requiredConfirmations', () => {
  const g = canDownloadManagedBackup(baseState(), {});
  assert.equal(g.allowed, false);
  assert.deepEqual(g.requiredConfirmations, [
    'confirmBackupContainsSensitiveData',
    'confirmSecureStorageResponsibility',
  ]);
});

test('typed confirmation mismatch blocked; constant is DOWNLOAD BACKUP', () => {
  assert.equal(BACKUP_DOWNLOAD_TYPED_CONFIRMATION, 'DOWNLOAD BACKUP');
  const g = canDownloadManagedBackup(baseState(), { ...FULL, typedConfirmation: 'download backup' });
  assert.ok(g.blockedReasons.includes('typedConfirmationMismatch'));
});

test('verify valid + all confirmations ⇒ allowed in plan, but executable stays false', () => {
  const plan = buildBackupDownloadPlan(baseState(), FULL);
  assert.equal(plan.decision, 'allowed');
  assert.equal(plan.executable, false);
  assert.equal(plan.dataSensitivity, 'sensitive');
  assert.equal(plan.plannedFlow.kind, 'webProxiedStreaming');
  assert.equal(plan.plannedFlow.browserToAgentDirect, false);
  assert.equal(plan.plannedFlow.bufferingAllowed, false);
  assert.equal(plan.sizeLimitPolicy.streamingRequired, true);
  assert.equal(plan.rateLimitPolicy.scope, 'ownerAndServer');
  assert.deepEqual(plan.auditEvents, Object.values(BACKUP_DOWNLOAD_AUDIT));
});

test('warnings: archived server and large/unknown file size warn but do not block', () => {
  const archived = canDownloadManagedBackup(baseState({ archived: true }), FULL);
  assert.equal(archived.allowed, true);
  assert.ok(archived.warnings.includes('serverArchived'));

  const large = canDownloadManagedBackup(baseState({ sizeBytes: BACKUP_DOWNLOAD_WARN_AT_BYTES }), FULL);
  assert.equal(large.allowed, true);
  assert.ok(large.warnings.includes('largeFile'));

  const unknown = canDownloadManagedBackup(baseState({ sizeBytes: null }), FULL);
  assert.equal(unknown.allowed, true);
  assert.ok(unknown.warnings.includes('sizeUnknown'));
});

test('validateBackupDownloadRequest covers mode/instanceId/role/fileName', () => {
  assert.equal(validateBackupDownloadRequest(baseState()).valid, true);
  const bad = validateBackupDownloadRequest(
    baseState({ mode: 'external', instanceId: 'bad id!', actorRole: 'USER', fileName: 'x' }),
  );
  assert.equal(bad.valid, false);
  assert.deepEqual(bad.reasons, ['notManaged', 'instanceIdInvalid', 'ownerRequired', 'fileNameInvalid']);
});

test('plan contains no secrets and no host paths', () => {
  for (const plan of [
    buildBackupDownloadPlan(baseState(), FULL),
    buildBackupDownloadPlan(baseState({ verifyStatus: 'mismatch' }), {}),
  ]) {
    const s = JSON.stringify(plan);
    assert.ok(!/password|serveradmin|TS3SERVERQUERY|encryptedPassword|bearer /i.test(s));
    assert.ok(!s.includes('/var/lib') && !/[A-Za-z]:\\\\/.test(s), 'no host paths');
    assert.ok(!s.includes('AGENT_BOOTSTRAP_TOKEN'), 'no secret env names');
  }
});

test('audit plan contains no file content, no file names, no checksums', () => {
  const events = Object.values(BACKUP_DOWNLOAD_AUDIT);
  const s = JSON.stringify(events);
  assert.ok(!s.includes('.tar.gz'));
  assert.ok(!/[0-9a-f]{64}/.test(s));
  assert.ok(events.every((e) => e.startsWith('backup.managedVolume.download.')));
});

test('step-036 source performs no file/db/agent operations and no exec/shell', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'provisioning', 'backup-download.ts'), 'utf8');
  const forbidden = [
    'node:fs',
    'node:child_process',
    'readFile',
    'writeFile',
    'createReadStream',
    'createWriteStream',
    'execFile',
    'spawn(',
    'fetch(',
    'prisma',
    'agent-client',
    "'docker'",
    'docker run',
    'docker.sock',
    'process.env',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
  assert.ok(src.includes('executable: false'), 'blueprint must stay non-executable');
});
