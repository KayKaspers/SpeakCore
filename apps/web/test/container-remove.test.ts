import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildContainerRemoveAuditEntries,
  containerRemoveErrorKey,
  removeSuccessUpdate,
  resolveContainerRemove,
} from '../src/core/container-remove-helpers';

test('resolveContainerRemove: CONTAINER_CREATED/RESOURCES_PREPARED ok, RUNNING ⇒ running, rest invalid', () => {
  assert.equal(resolveContainerRemove('CONTAINER_CREATED'), 'ok');
  assert.equal(resolveContainerRemove('RESOURCES_PREPARED'), 'ok'); // idempotent
  assert.equal(resolveContainerRemove('RUNNING'), 'running'); // must stop first
  assert.equal(resolveContainerRemove('CONTAINER_PENDING'), 'invalidState');
  assert.equal(resolveContainerRemove('DRAFT'), 'invalidState');
  assert.equal(resolveContainerRemove(null), 'invalidState'); // external server
});

test('removeSuccessUpdate keeps credentials/volume/network untouched, resets lifecycle', () => {
  const upd = removeSuccessUpdate();
  assert.equal(upd.provisioningStatus, 'RESOURCES_PREPARED');
  assert.equal(upd.runState, 'unknown');
  assert.equal(upd.lastProvisioningErrorKey, null);
  const keys = Object.keys(upd);
  // must NOT delete/overwrite credentials or managed volume/network references
  for (const forbidden of ['credential', 'managedVolumeName', 'managedNetworkName', 'managedContainerName']) {
    assert.ok(!keys.includes(forbidden), `removeSuccessUpdate must not touch ${forbidden}`);
  }
});

test('audit: removed ⇒ requested + container.removed + completed', () => {
  const entries = buildContainerRemoveAuditEntries('removed', 'owner@example.com', 'srv-7');
  assert.deepEqual(
    entries.map((e) => e.action),
    ['docker.containerRemove.requested', 'docker.container.removed', 'docker.containerRemove.completed'],
  );
  for (const e of entries) assert.equal(e.target, 'srv-7');
});

test('audit: alreadyRemoved ⇒ idempotent completed', () => {
  const actions = buildContainerRemoveAuditEntries('alreadyRemoved', 'o@e.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, [
    'docker.containerRemove.requested',
    'docker.container.alreadyRemoved',
    'docker.containerRemove.completed',
  ]);
});

test('audit: stillRunning ⇒ stillRunning + failed (both failure)', () => {
  const entries = buildContainerRemoveAuditEntries('stillRunning', 'o@e.com', 'srv-7');
  assert.deepEqual(
    entries.map((e) => e.action),
    ['docker.containerRemove.requested', 'docker.containerRemove.stillRunning', 'docker.containerRemove.failed'],
  );
  assert.equal(entries[1].result, 'failure');
  assert.equal(entries[2].result, 'failure');
});

test('audit: conflict ⇒ conflict + failed', () => {
  const actions = buildContainerRemoveAuditEntries('conflict', 'o@e.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, [
    'docker.containerRemove.requested',
    'docker.containerRemove.conflict',
    'docker.containerRemove.failed',
  ]);
});

test('audit entries never contain secrets', () => {
  for (const kind of ['removed', 'alreadyRemoved', 'stillRunning', 'conflict', 'failed'] as const) {
    const s = JSON.stringify(buildContainerRemoveAuditEntries(kind, 'o@e.com', 'srv-7'));
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s));
  }
});

test('containerRemoveErrorKey maps failure states to generic keys', () => {
  assert.equal(containerRemoveErrorKey('stillRunning'), 'stillRunning');
  assert.equal(containerRemoveErrorKey('writeDisabled'), 'writeDisabled');
  assert.equal(containerRemoveErrorKey('unavailable'), 'unavailable');
  assert.equal(containerRemoveErrorKey('unreachable'), 'unreachable');
  assert.equal(containerRemoveErrorKey('conflict'), 'conflict');
  assert.equal(containerRemoveErrorKey('error'), 'removeFailed');
  assert.equal(containerRemoveErrorKey('removed'), null);
  assert.equal(containerRemoveErrorKey('alreadyRemoved'), null);
});

test('container-remove sources contain no forbidden docker commands / no socket', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = ['container-remove.ts', 'container-remove-helpers.ts'].map((f) =>
    readFileSync(join(coreDir, f), 'utf8'),
  );
  const forbidden = [
    'rm -f',
    'rm -v',
    'volume rm',
    'network rm',
    'docker run',
    'docker create',
    'docker start',
    'docker stop',
    'docker restart',
    'docker logs',
    'docker exec',
    'docker inspect',
    'execFile',
    'docker.sock',
    '/var/run/docker.sock',
  ];
  for (const src of sources) {
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token present: ${token}`);
    }
  }
});
