import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildContainerStartAuditEntries,
  containerStartErrorKey,
  resolveContainerStart,
} from '../src/core/container-start-helpers';

test('resolveContainerStart: only CONTAINER_CREATED/RUNNING are allowed', () => {
  assert.equal(resolveContainerStart('CONTAINER_CREATED'), 'ok');
  assert.equal(resolveContainerStart('RUNNING'), 'ok'); // idempotent
  assert.equal(resolveContainerStart('CONTAINER_PENDING'), 'invalidState');
  assert.equal(resolveContainerStart('RESOURCES_PREPARED'), 'invalidState');
  assert.equal(resolveContainerStart('DRAFT'), 'invalidState');
  assert.equal(resolveContainerStart('ERROR'), 'invalidState');
  assert.equal(resolveContainerStart(null), 'invalidState'); // external server
});

test('audit: started with license confirmed ⇒ requested + licenseConfirmed + started + completed', () => {
  const entries = buildContainerStartAuditEntries('started', 'owner@example.com', 'srv-7', true);
  assert.deepEqual(
    entries.map((e) => e.action),
    [
      'docker.containerStart.requested',
      'docker.containerStart.licenseConfirmed',
      'docker.container.started',
      'docker.containerStart.completed',
    ],
  );
  for (const e of entries) assert.equal(e.target, 'srv-7');
});

test('audit: already running ⇒ alreadyRunning + completed', () => {
  const actions = buildContainerStartAuditEntries('running', 'o@e.com', 'srv-7', true).map((e) => e.action);
  assert.deepEqual(actions, [
    'docker.containerStart.requested',
    'docker.containerStart.licenseConfirmed',
    'docker.container.alreadyRunning',
    'docker.containerStart.completed',
  ]);
});

test('audit: conflict ⇒ containerStart.conflict + failed (both failure)', () => {
  const entries = buildContainerStartAuditEntries('conflict', 'o@e.com', 'srv-7', true);
  assert.deepEqual(
    entries.map((e) => e.action),
    [
      'docker.containerStart.requested',
      'docker.containerStart.licenseConfirmed',
      'docker.containerStart.conflict',
      'docker.containerStart.failed',
    ],
  );
  assert.equal(entries[2].result, 'failure');
  assert.equal(entries[3].result, 'failure');
});

test('audit: no license confirmation ⇒ requested + failed, NO licenseConfirmed event', () => {
  const actions = buildContainerStartAuditEntries('failed', 'o@e.com', 'srv-7', false).map((e) => e.action);
  assert.deepEqual(actions, ['docker.containerStart.requested', 'docker.containerStart.failed']);
  assert.ok(!actions.includes('docker.containerStart.licenseConfirmed'));
});

test('audit entries never contain secrets', () => {
  for (const kind of ['started', 'running', 'conflict', 'failed'] as const) {
    const s = JSON.stringify(buildContainerStartAuditEntries(kind, 'o@e.com', 'srv-7', true));
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s));
  }
});

test('containerStartErrorKey maps failure states to generic keys', () => {
  assert.equal(containerStartErrorKey('writeDisabled'), 'writeDisabled');
  assert.equal(containerStartErrorKey('unavailable'), 'unavailable');
  assert.equal(containerStartErrorKey('unreachable'), 'unreachable');
  assert.equal(containerStartErrorKey('conflict'), 'conflict');
  assert.equal(containerStartErrorKey('notFound'), 'notFound');
  assert.equal(containerStartErrorKey('error'), 'startFailed');
  assert.equal(containerStartErrorKey('invalidPlan'), 'invalidPlan');
  assert.equal(containerStartErrorKey('started'), null);
  assert.equal(containerStartErrorKey('running'), null);
  assert.equal(containerStartErrorKey('licenseRequired'), null); // Status unverändert, kein Fehlerschlüssel
});

test('container-start sources contain no docker commands / no log reading / no socket', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = ['container-start.ts', 'container-start-helpers.ts'].map((f) =>
    readFileSync(join(coreDir, f), 'utf8'),
  );
  const forbidden = [
    'docker run',
    'docker create',
    'docker stop',
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
