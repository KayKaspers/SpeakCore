import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildVolumeRemoveAuditEntries,
  mapVolumeConfirmationGuard,
  volumeRemoveErrorKey,
  volumeRemoveSuccessUpdate,
} from '../src/core/volume-remove-helpers';

const FULL = { confirmVolumeDataLoss: true, confirmBackupRecommended: true, typedConfirmation: 'DELETE VOLUME' };

test('confirmation guard: only RESOURCES_PREPARED with all confirmations passes', () => {
  assert.equal(mapVolumeConfirmationGuard('RESOURCES_PREPARED', FULL), 'ok');
  assert.equal(mapVolumeConfirmationGuard('CONTAINER_CREATED', FULL), 'invalidState');
  assert.equal(mapVolumeConfirmationGuard('RUNNING', FULL), 'invalidState');
  assert.equal(mapVolumeConfirmationGuard(null, FULL), 'invalidState');
});

test('confirmation guard: missing data-loss confirmation blocks', () => {
  assert.equal(
    mapVolumeConfirmationGuard('RESOURCES_PREPARED', {
      confirmBackupRecommended: true,
      typedConfirmation: 'DELETE VOLUME',
    }),
    'dataLossRequired',
  );
});

test('confirmation guard: missing backup confirmation blocks', () => {
  assert.equal(
    mapVolumeConfirmationGuard('RESOURCES_PREPARED', {
      confirmVolumeDataLoss: true,
      typedConfirmation: 'DELETE VOLUME',
    }),
    'backupRequired',
  );
});

test('confirmation guard: wrong/empty typed confirmation blocks (typedMismatch)', () => {
  assert.equal(
    mapVolumeConfirmationGuard('RESOURCES_PREPARED', {
      confirmVolumeDataLoss: true,
      confirmBackupRecommended: true,
      typedConfirmation: 'delete volume',
    }),
    'typedMismatch',
  );
  assert.equal(
    mapVolumeConfirmationGuard('RESOURCES_PREPARED', {
      confirmVolumeDataLoss: true,
      confirmBackupRecommended: true,
      typedConfirmation: '',
    }),
    'typedMismatch',
  );
});

test('volumeRemoveSuccessUpdate keeps credentials/network/record/status untouched', () => {
  const upd = volumeRemoveSuccessUpdate();
  assert.equal(upd.managedVolumeState, 'removed');
  assert.equal(upd.lastProvisioningErrorKey, null);
  const keys = Object.keys(upd);
  for (const forbidden of [
    'credential',
    'managedNetworkName',
    'managedVolumeName',
    'provisioningStatus',
  ]) {
    assert.ok(!keys.includes(forbidden), `must not touch ${forbidden}`);
  }
});

test('audit: removed ⇒ requested + confirmed + volume.removed + completed', () => {
  const actions = buildVolumeRemoveAuditEntries({
    actor: 'owner@example.com',
    serverId: 'srv-7',
    confirmed: true,
    outcome: 'removed',
  }).map((e) => e.action);
  assert.deepEqual(actions, [
    'deprovision.volumeRemove.requested',
    'deprovision.volumeRemove.confirmed',
    'deprovision.volume.removed',
    'deprovision.volumeRemove.completed',
  ]);
});

test('audit: alreadyRemoved ⇒ idempotent completed', () => {
  const actions = buildVolumeRemoveAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    confirmed: true,
    outcome: 'alreadyRemoved',
  }).map((e) => e.action);
  assert.deepEqual(actions, [
    'deprovision.volumeRemove.requested',
    'deprovision.volumeRemove.confirmed',
    'deprovision.volume.alreadyRemoved',
    'deprovision.volumeRemove.completed',
  ]);
});

test('audit: web-side block (no confirmed event)', () => {
  const actions = buildVolumeRemoveAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    confirmed: false,
    outcome: 'blocked',
  }).map((e) => e.action);
  assert.deepEqual(actions, ['deprovision.volumeRemove.requested', 'deprovision.volumeRemove.blocked']);
  assert.ok(!actions.includes('deprovision.volumeRemove.confirmed'));
});

test('audit: conflict ⇒ conflict + failed (both failure)', () => {
  const entries = buildVolumeRemoveAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    confirmed: true,
    outcome: 'conflict',
  });
  assert.deepEqual(
    entries.map((e) => e.action),
    [
      'deprovision.volumeRemove.requested',
      'deprovision.volumeRemove.confirmed',
      'deprovision.volumeRemove.conflict',
      'deprovision.volumeRemove.failed',
    ],
  );
  assert.equal(entries[2].result, 'failure');
});

test('audit entries never contain secrets', () => {
  for (const outcome of ['removed', 'alreadyRemoved', 'conflict', 'blocked', 'failed'] as const) {
    const s = JSON.stringify(
      buildVolumeRemoveAuditEntries({ actor: 'o@e.com', serverId: 'srv-7', confirmed: true, outcome }),
    );
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s));
  }
});

test('volumeRemoveErrorKey maps failure states', () => {
  assert.equal(volumeRemoveErrorKey('containerStillExists'), 'containerStillExists');
  assert.equal(volumeRemoveErrorKey('conflict'), 'conflict');
  assert.equal(volumeRemoveErrorKey('unavailable'), 'unavailable');
  assert.equal(volumeRemoveErrorKey('unreachable'), 'unreachable');
  assert.equal(volumeRemoveErrorKey('error'), 'volumeRemoveFailed');
  assert.equal(volumeRemoveErrorKey('removed'), null);
  assert.equal(volumeRemoveErrorKey('dataLossRequired'), null);
});

test('volume-remove sources contain no docker commands / no force / no socket', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = ['volume-remove.ts', 'volume-remove-helpers.ts'].map((f) =>
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
