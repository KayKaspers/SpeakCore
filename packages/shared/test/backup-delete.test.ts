import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type {
  BackupDeleteConfirmations,
  BackupDeleteState,
  BackupRotationEntry,
} from '@speakcore/types';
import {
  BACKUP_DELETE_AUDIT,
  BACKUP_DELETE_TYPED_CONFIRMATION,
  BACKUP_ROTATION_AUDIT,
  BACKUP_ROTATION_TYPED_CONFIRMATION,
  DEFAULT_BACKUP_ROTATION_POLICY,
  buildBackupDeletePlan,
  buildBackupRotationPlan,
  canDeleteManagedBackup,
  isDeletableBackupFileName,
  validateBackupDeleteRequest,
} from '../src/provisioning';

const INSTANCE = 'clabc123def456';
const OTHER_INSTANCE = 'clzzz999yyy888';
const FILE = `speakcore-backup-ts3-${INSTANCE}-2026-07-02T10-00-00-000Z.tar.gz`;
const NOW = new Date('2026-07-02T12:00:00.000Z');

function baseState(overrides: Partial<BackupDeleteState> = {}): BackupDeleteState {
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
    createdAt: '2026-07-02T10:00:00.000Z',
    isOnlyBackup: false,
    ...overrides,
  };
}

const FULL: BackupDeleteConfirmations = {
  confirmBackupDeletion: true,
  confirmBackupMayBeOnlyCopy: true,
  confirmNoRestoreWithoutBackup: true,
  typedConfirmation: 'DELETE BACKUP',
};

test('external server blocked; non-owner blocked', () => {
  const ext = canDeleteManagedBackup(baseState({ mode: 'external' }), FULL);
  assert.equal(ext.allowed, false);
  assert.ok(ext.blockedReasons.includes('notManaged'));

  const user = canDeleteManagedBackup(baseState({ actorRole: 'USER' }), FULL);
  assert.ok(user.blockedReasons.includes('ownerRequired'));
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
    const g = canDeleteManagedBackup(baseState({ fileName }), FULL);
    assert.equal(g.allowed, false, `fileName: ${fileName}`);
    assert.ok(g.blockedReasons.includes('fileNameInvalid'));
  }
  assert.equal(isDeletableBackupFileName(INSTANCE, FILE), true);
  assert.equal(isDeletableBackupFileName(INSTANCE, 42), false);
});

test('backup missing blocked', () => {
  const g = canDeleteManagedBackup(baseState({ backupExists: false }), FULL);
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('backupNotFound'));
});

test('each missing confirmation blocks; wrong typed confirmation blocks', () => {
  assert.deepEqual(canDeleteManagedBackup(baseState(), {}).requiredConfirmations, [
    'confirmBackupDeletion',
    'confirmBackupMayBeOnlyCopy',
    'confirmNoRestoreWithoutBackup',
  ]);
  for (const missing of [
    { ...FULL, confirmBackupDeletion: false },
    { ...FULL, confirmBackupMayBeOnlyCopy: false },
    { ...FULL, confirmNoRestoreWithoutBackup: false },
  ]) {
    assert.equal(canDeleteManagedBackup(baseState(), missing).allowed, false);
  }
  assert.equal(BACKUP_DELETE_TYPED_CONFIRMATION, 'DELETE BACKUP');
  const typed = canDeleteManagedBackup(baseState(), { ...FULL, typedConfirmation: 'delete backup' });
  assert.ok(typed.blockedReasons.includes('typedConfirmationMismatch'));
});

test('valid state ⇒ allowed plan, but executable stays false and dataLossRisk irreversible', () => {
  const plan = buildBackupDeletePlan(baseState(), FULL);
  assert.equal(plan.decision, 'allowed');
  assert.equal(plan.executable, false);
  assert.equal(plan.dataLossRisk, 'irreversible');
  assert.equal(plan.plannedActions[0].action, 'DELETE_MANAGED_BACKUP');
  assert.equal(plan.plannedActions[0].wildcardsAllowed, false);
  assert.equal(plan.plannedActions[0].deletesMetadataFile, true);
  assert.deepEqual(plan.auditEvents, Object.values(BACKUP_DELETE_AUDIT));
});

test('verify mismatch / never verified / metadata / checksum issues warn but do NOT block', () => {
  const mismatch = canDeleteManagedBackup(baseState({ verifyStatus: 'mismatch' }), FULL);
  assert.equal(mismatch.allowed, true);
  assert.ok(mismatch.warnings.includes('verifyMismatch'));

  const never = canDeleteManagedBackup(baseState({ verifyStatus: 'notVerified' }), FULL);
  assert.equal(never.allowed, true);
  assert.ok(never.warnings.includes('neverVerified'));

  const noMeta = canDeleteManagedBackup(baseState({ metadataStatus: 'missing' }), FULL);
  assert.equal(noMeta.allowed, true);
  assert.ok(noMeta.warnings.includes('metadataMissing'));

  const noChecksum = canDeleteManagedBackup(
    baseState({ checksumPresent: false, verifyStatus: 'checksumMissing' }),
    FULL,
  );
  assert.equal(noChecksum.allowed, true);
  assert.ok(noChecksum.warnings.includes('checksumMissing'));
});

test('only backup / archived server / large file warn but do NOT block', () => {
  const only = canDeleteManagedBackup(baseState({ isOnlyBackup: true }), FULL);
  assert.equal(only.allowed, true);
  assert.ok(only.warnings.includes('onlyBackup'));

  const archived = canDeleteManagedBackup(baseState({ archived: true }), FULL);
  assert.equal(archived.allowed, true);
  assert.ok(archived.warnings.includes('serverArchived'));

  const large = canDeleteManagedBackup(baseState({ sizeBytes: 2 * 1024 * 1024 * 1024 }), FULL);
  assert.ok(large.warnings.includes('largeFile'));
});

test('validateBackupDeleteRequest covers mode/instanceId/role/fileName', () => {
  assert.equal(validateBackupDeleteRequest(baseState()).valid, true);
  const bad = validateBackupDeleteRequest(
    baseState({ mode: 'external', instanceId: 'bad id!', actorRole: 'USER', fileName: 'x' }),
  );
  assert.deepEqual(bad.reasons, ['notManaged', 'instanceIdInvalid', 'ownerRequired', 'fileNameInvalid']);
});

function entry(daysOld: number, verified = false): BackupRotationEntry {
  const createdAt = new Date(NOW.getTime() - daysOld * 24 * 60 * 60 * 1000).toISOString();
  const ts = createdAt.replace(/[:.]/g, '-');
  return { fileName: `speakcore-backup-ts3-${INSTANCE}-${ts}.tar.gz`, createdAt, verified };
}

const ROTATION_FULL = {
  confirmRotationPolicyReviewed: true,
  confirmBulkDeletionRisk: true,
  typedConfirmation: 'DELETE BACKUPS',
};

test('rotation plan is ALWAYS a dry run with executable false', () => {
  assert.equal(BACKUP_ROTATION_TYPED_CONFIRMATION, 'DELETE BACKUPS');
  const backups = [entry(1), entry(10), entry(30), entry(100), entry(200)];
  const plan = buildBackupRotationPlan(backups, DEFAULT_BACKUP_ROTATION_POLICY, ROTATION_FULL, NOW);
  assert.equal(plan.decision, 'dryRun');
  assert.equal(plan.dryRun, true);
  assert.equal(plan.executable, false);
  // keepLastCount 3 schützt die 3 neuesten; die 2 ältesten sind Kandidaten:
  assert.equal(plan.deleteCandidates.length, 2);
  assert.equal(plan.kept.length, 3);
  assert.deepEqual(plan.auditEvents, Object.values(BACKUP_ROTATION_AUDIT));
});

test('rotation: missing confirmations / wrong typed confirmation ⇒ blocked (still no deletion possible)', () => {
  const backups = [entry(1), entry(100)];
  const blocked = buildBackupRotationPlan(backups, DEFAULT_BACKUP_ROTATION_POLICY, {}, NOW);
  assert.equal(blocked.decision, 'blocked');
  assert.deepEqual(blocked.requiredConfirmations, [
    'confirmRotationPolicyReviewed',
    'confirmBulkDeletionRisk',
  ]);
  const typed = buildBackupRotationPlan(
    backups,
    DEFAULT_BACKUP_ROTATION_POLICY,
    { ...ROTATION_FULL, typedConfirmation: 'delete backups' },
    NOW,
  );
  assert.ok(typed.blockedReasons.includes('typedConfirmationMismatch'));
  assert.equal(typed.executable, false);
});

test('rotation protections: only backup, keepMinAgeDays, last verified backup', () => {
  const single = buildBackupRotationPlan(
    [entry(500)],
    { protectLastVerifiedBackup: true, protectOnlyBackup: true, dryRun: true },
    ROTATION_FULL,
    NOW,
  );
  assert.equal(single.deleteCandidates.length, 0);
  assert.deepEqual(single.kept[0].protectedBy, ['onlyBackup']);

  const backups = [entry(2), entry(50, true), entry(300)];
  const plan = buildBackupRotationPlan(
    backups,
    { keepMinAgeDays: 7, protectLastVerifiedBackup: true, protectOnlyBackup: true, dryRun: true },
    ROTATION_FULL,
    NOW,
  );
  // entry(2) jünger als 7 Tage ⇒ geschützt; entry(50, verified) ⇒ geschützt; entry(300) ⇒ Kandidat.
  assert.deepEqual(plan.deleteCandidates, [entry(300).fileName]);
  const keptNames = plan.kept.map((k) => k.fileName).sort();
  assert.deepEqual(keptNames, [entry(2).fileName, entry(50).fileName].sort());
});

test('rotation: deleteOlderThanDays keeps entries that are not old enough', () => {
  const backups = [entry(10), entry(40), entry(100)];
  const plan = buildBackupRotationPlan(
    backups,
    { deleteOlderThanDays: 60, protectLastVerifiedBackup: false, protectOnlyBackup: false, dryRun: true },
    ROTATION_FULL,
    NOW,
  );
  assert.deepEqual(plan.deleteCandidates, [entry(100).fileName]);
  assert.ok(
    plan.kept.some((k) => k.fileName === entry(40).fileName && k.protectedBy.includes('notOldEnough')),
  );
});

test('rotation warns when the plan would delete ALL backups', () => {
  const plan = buildBackupRotationPlan(
    [entry(100), entry(200)],
    { protectLastVerifiedBackup: false, protectOnlyBackup: false, dryRun: true },
    ROTATION_FULL,
    NOW,
  );
  assert.equal(plan.deleteCandidates.length, 2);
  assert.ok(plan.warnings.includes('wouldDeleteAllBackups'));
});

test('plans contain no secrets and no host paths', () => {
  for (const s of [
    JSON.stringify(buildBackupDeletePlan(baseState(), FULL)),
    JSON.stringify(buildBackupDeletePlan(baseState({ verifyStatus: 'mismatch' }), {})),
    JSON.stringify(
      buildBackupRotationPlan([entry(1), entry(100)], DEFAULT_BACKUP_ROTATION_POLICY, ROTATION_FULL, NOW),
    ),
  ]) {
    assert.ok(!/password|serveradmin|TS3SERVERQUERY|encryptedPassword|bearer /i.test(s));
    assert.ok(!s.includes('/var/lib') && !/[A-Za-z]:\\\\/.test(s), 'no host paths');
  }
});

test('audit plan contains no file names/content and follows the established naming', () => {
  const events = [...Object.values(BACKUP_DELETE_AUDIT), ...Object.values(BACKUP_ROTATION_AUDIT)];
  const s = JSON.stringify(events);
  assert.ok(!s.includes('.tar.gz'));
  assert.ok(!/[0-9a-f]{64}/.test(s));
  assert.ok(events.every((e) => e.startsWith('backup.managedVolume.')));
});

test('step-039 source performs no file/db/agent operations and no exec/shell/delete calls', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'provisioning', 'backup-delete.ts'), 'utf8');
  const forbidden = [
    'node:fs',
    'node:child_process',
    'unlink',
    'rmdir',
    'rm(',
    'readdir',
    'readFile',
    'writeFile',
    'createReadStream',
    'execFile',
    'spawn(',
    'fetch(',
    'prisma',
    'agent-client',
    "'docker'",
    'docker run',
    'docker.sock',
    'process.env',
    'setInterval',
    'setTimeout',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
  assert.ok(src.includes('executable: false'), 'blueprint must stay non-executable');
});
