import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { VolumeBackupConfirmations, VolumeBackupState } from '@speakcore/types';
import {
  BACKUP_VERSION,
  buildBackupMetadata,
  buildManagedVolumeBackupPlan,
  canBackupManagedVolume,
  validateManagedVolumeBackupRequest,
} from '../src/provisioning';

const INSTANCE = 'clabc123def456';

function baseState(overrides: Partial<VolumeBackupState> = {}): VolumeBackupState {
  return {
    instanceId: INSTANCE,
    mode: 'managed',
    provisioningStatus: 'RESOURCES_PREPARED',
    runState: 'stopped',
    serverDisplayName: 'My Managed TS3',
    managedVolumeName: 'speakcore-volume-ts3-clabc123def456',
    managedVolumeState: null,
    volume: { exists: true, managed: true },
    container: { exists: false, running: false },
    ...overrides,
  };
}

const FULL: VolumeBackupConfirmations = {
  confirmBackupMayContainSensitiveData: true,
  confirmBackupStorageResponsibility: true,
  confirmContainerShouldBeStopped: true,
};

test('backup blocked for external server', () => {
  const g = canBackupManagedVolume(baseState({ mode: 'external' }), FULL);
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('notManaged'));
});

test('backup blocked when volume is missing', () => {
  const g = canBackupManagedVolume(baseState({ volume: { exists: false, managed: true } }), FULL);
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('volumeNotFound'));
});

test('backup blocked for unmanaged (foreign) volume', () => {
  const g = canBackupManagedVolume(baseState({ volume: { exists: true, managed: false } }), FULL);
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('volumeNotManaged'));
});

test('backup blocked when volume was removed', () => {
  const g = canBackupManagedVolume(baseState({ managedVolumeState: 'removed' }), FULL);
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('volumeRemoved'));
});

test('backup blocked while container is running (conservative)', () => {
  const g = canBackupManagedVolume(baseState({ container: { exists: true, running: true } }), FULL);
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('containerRunning'));
});

test('backup blocked without sensitive-data confirmation', () => {
  const g = canBackupManagedVolume(baseState(), {
    confirmBackupStorageResponsibility: true,
    confirmContainerShouldBeStopped: true,
  });
  assert.equal(g.allowed, false);
  assert.ok(g.requiredConfirmations.includes('confirmBackupMayContainSensitiveData'));
});

test('backup blocked without storage-responsibility confirmation', () => {
  const g = canBackupManagedVolume(baseState(), {
    confirmBackupMayContainSensitiveData: true,
    confirmContainerShouldBeStopped: true,
  });
  assert.equal(g.allowed, false);
  assert.ok(g.requiredConfirmations.includes('confirmBackupStorageResponsibility'));
});

test('backup blocked on typed-confirmation mismatch', () => {
  const g = canBackupManagedVolume(baseState(), { ...FULL, typedConfirmation: 'nope' });
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('typedConfirmationMismatch'));
});

test('valid managed + stopped container + confirmations ⇒ allowed', () => {
  const g = canBackupManagedVolume(baseState(), FULL);
  assert.equal(g.allowed, true);
  assert.deepEqual(g.blockedReasons, []);
  assert.equal(validateManagedVolumeBackupRequest({ state: baseState(), confirmations: FULL }).decision, 'allowed');
});

test('plan is never executable and marks sensitive data + read-only source', () => {
  const plan = buildManagedVolumeBackupPlan({ state: baseState(), confirmations: FULL });
  assert.equal(plan.executable, false);
  assert.equal(plan.decision, 'allowed');
  assert.equal(plan.dataSensitivity, 'sensitive');
  assert.equal(plan.plannedActions[0].readOnlySource, true);
  assert.match(plan.backupFormat, /^speakcore-backup-ts3-clabc123def456-<timestamp>\.tar\.gz$/);
  assert.equal(plan.backupMetadata?.containsSecrets, 'unknown');
  assert.equal(plan.backupMetadata?.backupVersion, BACKUP_VERSION);
});

test('plan/metadata/audit contain no secrets', () => {
  const plan = buildManagedVolumeBackupPlan({ state: baseState(), confirmations: FULL });
  assert.ok(!/password|secret(?!s)|token|serveradmin|v1:/i.test(JSON.stringify(plan).replace(/containsSecrets/g, '')));
  const meta = buildBackupMetadata({ instanceId: INSTANCE, serverDisplayName: 'x', volumeName: 'v' });
  assert.ok(!/password|token|serveradmin|v1:/i.test(JSON.stringify(meta)));
});

test('backup source introduces no docker/agent/db/exec', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'provisioning', 'backup.ts'), 'utf8');
  const forbidden = ['docker ', 'docker run', 'execFile', 'prisma', 'agent-client', 'child_process', 'tar '];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
});
