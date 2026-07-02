import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildContainerStopAuditEntries,
  containerStopErrorKey,
  resolveContainerStop,
} from '../src/core/container-stop-helpers';

test('resolveContainerStop: only RUNNING/CONTAINER_CREATED are allowed', () => {
  assert.equal(resolveContainerStop('RUNNING'), 'ok');
  assert.equal(resolveContainerStop('CONTAINER_CREATED'), 'ok'); // idempotent
  assert.equal(resolveContainerStop('CONTAINER_PENDING'), 'invalidState');
  assert.equal(resolveContainerStop('RESOURCES_PREPARED'), 'invalidState');
  assert.equal(resolveContainerStop('DRAFT'), 'invalidState');
  assert.equal(resolveContainerStop('ERROR'), 'invalidState');
  assert.equal(resolveContainerStop(null), 'invalidState'); // external server
});

test('audit: stopped ⇒ requested + container.stopped + completed', () => {
  const entries = buildContainerStopAuditEntries('stopped', 'owner@example.com', 'srv-7');
  assert.deepEqual(
    entries.map((e) => e.action),
    ['docker.containerStop.requested', 'docker.container.stopped', 'docker.containerStop.completed'],
  );
  for (const e of entries) assert.equal(e.target, 'srv-7');
});

test('audit: already stopped ⇒ alreadyStopped + completed (idempotent)', () => {
  const actions = buildContainerStopAuditEntries('alreadyStopped', 'o@e.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, [
    'docker.containerStop.requested',
    'docker.container.alreadyStopped',
    'docker.containerStop.completed',
  ]);
});

test('audit: conflict ⇒ containerStop.conflict + failed (both failure)', () => {
  const entries = buildContainerStopAuditEntries('conflict', 'o@e.com', 'srv-7');
  assert.deepEqual(
    entries.map((e) => e.action),
    ['docker.containerStop.requested', 'docker.containerStop.conflict', 'docker.containerStop.failed'],
  );
  assert.equal(entries[1].result, 'failure');
  assert.equal(entries[2].result, 'failure');
});

test('audit: failed ⇒ requested + failed', () => {
  const actions = buildContainerStopAuditEntries('failed', 'o@e.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, ['docker.containerStop.requested', 'docker.containerStop.failed']);
});

test('audit entries never contain secrets', () => {
  for (const kind of ['stopped', 'alreadyStopped', 'conflict', 'failed'] as const) {
    const s = JSON.stringify(buildContainerStopAuditEntries(kind, 'o@e.com', 'srv-7'));
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s));
  }
});

test('containerStopErrorKey maps failure states to generic keys', () => {
  assert.equal(containerStopErrorKey('writeDisabled'), 'writeDisabled');
  assert.equal(containerStopErrorKey('unavailable'), 'unavailable');
  assert.equal(containerStopErrorKey('unreachable'), 'unreachable');
  assert.equal(containerStopErrorKey('conflict'), 'conflict');
  assert.equal(containerStopErrorKey('notFound'), 'notFound');
  assert.equal(containerStopErrorKey('error'), 'stopFailed');
  assert.equal(containerStopErrorKey('invalidPlan'), 'invalidPlan');
  assert.equal(containerStopErrorKey('stopped'), null);
  assert.equal(containerStopErrorKey('alreadyStopped'), null);
});

test('container-stop sources contain no docker commands / no log reading / no socket', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = ['container-stop.ts', 'container-stop-helpers.ts'].map((f) =>
    readFileSync(join(coreDir, f), 'utf8'),
  );
  const forbidden = [
    'docker run',
    'docker create',
    'docker start',
    'docker restart',
    'docker rm',
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
