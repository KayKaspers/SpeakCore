import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildContainerCreateAuditEntries,
  containerCreateErrorKey,
  resolveContainerCreate,
} from '../src/core/container-create-helpers';

test('resolveContainerCreate: only CONTAINER_PENDING/CREATED are allowed', () => {
  assert.equal(resolveContainerCreate('CONTAINER_PENDING'), 'ok');
  assert.equal(resolveContainerCreate('CONTAINER_CREATED'), 'ok'); // idempotent
  assert.equal(resolveContainerCreate('DRAFT'), 'invalidState');
  assert.equal(resolveContainerCreate('RESOURCES_PREPARED'), 'invalidState');
  assert.equal(resolveContainerCreate('RESOURCE_PREPARE_FAILED'), 'invalidState');
  assert.equal(resolveContainerCreate('ERROR'), 'invalidState');
  assert.equal(resolveContainerCreate(null), 'invalidState'); // external server
});

test('audit: created ⇒ requested + container.created + completed, target = serverId', () => {
  const entries = buildContainerCreateAuditEntries('created', 'owner@example.com', 'srv-7');
  assert.deepEqual(
    entries.map((e) => e.action),
    ['docker.containerCreate.requested', 'docker.container.created', 'docker.containerCreate.completed'],
  );
  for (const e of entries) assert.equal(e.target, 'srv-7');
});

test('audit: exists ⇒ container.exists + completed', () => {
  const actions = buildContainerCreateAuditEntries('exists', 'o@e.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, [
    'docker.containerCreate.requested',
    'docker.container.exists',
    'docker.containerCreate.completed',
  ]);
});

test('audit: conflict ⇒ container.conflict + failed (both failure)', () => {
  const entries = buildContainerCreateAuditEntries('conflict', 'o@e.com', 'srv-7');
  assert.deepEqual(
    entries.map((e) => e.action),
    ['docker.containerCreate.requested', 'docker.container.conflict', 'docker.containerCreate.failed'],
  );
  assert.equal(entries[1].result, 'failure');
  assert.equal(entries[2].result, 'failure');
});

test('audit: failed ⇒ requested + failed only', () => {
  const actions = buildContainerCreateAuditEntries('failed', 'o@e.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, ['docker.containerCreate.requested', 'docker.containerCreate.failed']);
});

test('audit entries never contain secrets', () => {
  for (const kind of ['created', 'exists', 'conflict', 'failed'] as const) {
    const s = JSON.stringify(buildContainerCreateAuditEntries(kind, 'o@e.com', 'srv-7'));
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s));
  }
});

test('containerCreateErrorKey maps failure states to generic keys', () => {
  assert.equal(containerCreateErrorKey('writeDisabled'), 'writeDisabled');
  assert.equal(containerCreateErrorKey('unavailable'), 'unavailable');
  assert.equal(containerCreateErrorKey('unreachable'), 'unreachable');
  assert.equal(containerCreateErrorKey('conflict'), 'conflict');
  assert.equal(containerCreateErrorKey('error'), 'createFailed');
  assert.equal(containerCreateErrorKey('invalidPlan'), 'invalidPlan');
  assert.equal(containerCreateErrorKey('created'), null);
  assert.equal(containerCreateErrorKey('exists'), null);
});

test('container-create sources contain no docker commands / no log reading / no socket', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = ['container-create.ts', 'container-create-helpers.ts'].map((f) =>
    readFileSync(join(coreDir, f), 'utf8'),
  );
  const forbidden = [
    'docker run',
    'docker start',
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
