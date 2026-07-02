import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildRestartAuditEntries,
  resolveRestart,
} from '../src/core/container-restart-helpers';

test('resolveRestart: only RUNNING may restart (no repair on inconsistency)', () => {
  assert.equal(resolveRestart('RUNNING'), 'ok');
  assert.equal(resolveRestart('CONTAINER_CREATED'), 'invalidState');
  assert.equal(resolveRestart('RESOURCES_PREPARED'), 'invalidState');
  assert.equal(resolveRestart('CONTAINER_PENDING'), 'invalidState');
  assert.equal(resolveRestart('DRAFT'), 'invalidState');
  assert.equal(resolveRestart(null), 'invalidState'); // external server
});

test('audit: completed ⇒ full ordered stop+start restart sequence', () => {
  const actions = buildRestartAuditEntries('completed', 'owner@example.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, [
    'docker.containerRestart.requested',
    'docker.containerRestart.licenseConfirmed',
    'docker.containerRestart.stopStarted',
    'docker.containerRestart.stopCompleted',
    'docker.containerRestart.startStarted',
    'docker.containerRestart.completed',
  ]);
});

test('audit: stopFailed ⇒ requested + licenseConfirmed + stopStarted + failed (no start phase)', () => {
  const actions = buildRestartAuditEntries('stopFailed', 'o@e.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, [
    'docker.containerRestart.requested',
    'docker.containerRestart.licenseConfirmed',
    'docker.containerRestart.stopStarted',
    'docker.containerRestart.failed',
  ]);
});

test('audit: startFailed ⇒ stop completed, start started, then failed', () => {
  const actions = buildRestartAuditEntries('startFailed', 'o@e.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, [
    'docker.containerRestart.requested',
    'docker.containerRestart.licenseConfirmed',
    'docker.containerRestart.stopStarted',
    'docker.containerRestart.stopCompleted',
    'docker.containerRestart.startStarted',
    'docker.containerRestart.failed',
  ]);
});

test('audit: licenseRequired ⇒ requested + failed, NO licenseConfirmed', () => {
  const actions = buildRestartAuditEntries('licenseRequired', 'o@e.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, ['docker.containerRestart.requested', 'docker.containerRestart.failed']);
  assert.ok(!actions.includes('docker.containerRestart.licenseConfirmed'));
});

test('audit: invalidState ⇒ requested + failed, NO licenseConfirmed', () => {
  const actions = buildRestartAuditEntries('invalidState', 'o@e.com', 'srv-7').map((e) => e.action);
  assert.deepEqual(actions, ['docker.containerRestart.requested', 'docker.containerRestart.failed']);
});

test('audit: target is the ServerInstance id; failure entries flagged; no secrets', () => {
  const entries = buildRestartAuditEntries('completed', 'o@e.com', 'srv-7');
  for (const e of entries) assert.equal(e.target, 'srv-7');
  const failEntry = buildRestartAuditEntries('stopFailed', 'o@e.com', 'srv-7').at(-1)!;
  assert.equal(failEntry.result, 'failure');
  for (const outcome of ['completed', 'stopFailed', 'startFailed', 'licenseRequired', 'invalidState'] as const) {
    const s = JSON.stringify(buildRestartAuditEntries(outcome, 'o@e.com', 'srv-7'));
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s));
  }
});

test('container-restart sources introduce no docker restart / no new docker command', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = ['container-restart.ts', 'container-restart-helpers.ts'].map((f) =>
    readFileSync(join(coreDir, f), 'utf8'),
  );
  const forbidden = [
    'docker restart',
    'docker run',
    'docker create',
    'docker rm',
    'docker stop',
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
