import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildManagedHealthAuditEntries,
  healthErrorKey,
  isDefiniteRuntime,
  resolveHealthcheck,
  runStateForRuntime,
} from '../src/core/managed-health-helpers';

test('resolveHealthcheck: only RUNNING (lifecycle) may trigger a health check', () => {
  assert.equal(resolveHealthcheck('RUNNING'), 'ok');
  assert.equal(resolveHealthcheck('CONTAINER_CREATED'), 'invalidState');
  assert.equal(resolveHealthcheck('CONTAINER_PENDING'), 'invalidState');
  assert.equal(resolveHealthcheck('DRAFT'), 'invalidState');
  assert.equal(resolveHealthcheck(null), 'invalidState');
});

test('healthErrorKey maps runtime → generic key (null when running)', () => {
  assert.equal(healthErrorKey('running'), null);
  assert.equal(healthErrorKey('created'), 'containerCreated');
  assert.equal(healthErrorKey('exited'), 'containerNotRunning');
  assert.equal(healthErrorKey('notFound'), 'notFound');
  assert.equal(healthErrorKey('conflict'), 'conflict');
  assert.equal(healthErrorKey('unavailable'), 'unavailable');
  assert.equal(healthErrorKey('error'), 'error');
});

test('runStateForRuntime maps runtime → running/stopped/unknown', () => {
  assert.equal(runStateForRuntime('running'), 'running');
  assert.equal(runStateForRuntime('created'), 'stopped');
  assert.equal(runStateForRuntime('exited'), 'stopped');
  assert.equal(runStateForRuntime('notFound'), 'unknown');
  assert.equal(runStateForRuntime('unavailable'), 'unknown');
});

test('isDefiniteRuntime: unavailable/error ⇒ check failed, otherwise completed', () => {
  for (const r of ['running', 'created', 'exited', 'notFound', 'conflict'] as const) {
    assert.equal(isDefiniteRuntime(r), true);
  }
  assert.equal(isDefiniteRuntime('unavailable'), false);
  assert.equal(isDefiniteRuntime('error'), false);
});

test('audit: running + ts3 reachable + completed', () => {
  const entries = buildManagedHealthAuditEntries({
    actor: 'owner@example.com',
    serverId: 'srv-7',
    containerRunning: true,
    ts3: 'reachable',
    outcome: 'completed',
  });
  assert.deepEqual(
    entries.map((e) => e.action),
    [
      'healthcheck.managed.requested',
      'healthcheck.container.running',
      'healthcheck.ts3.reachable',
      'healthcheck.managed.completed',
    ],
  );
  for (const e of entries) assert.equal(e.target, 'srv-7');
});

test('audit: not running + no ts3 check + failed', () => {
  const entries = buildManagedHealthAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    containerRunning: false,
    ts3: null,
    outcome: 'failed',
  });
  assert.deepEqual(
    entries.map((e) => e.action),
    ['healthcheck.managed.requested', 'healthcheck.container.notRunning', 'healthcheck.managed.failed'],
  );
  assert.equal(entries.at(-1)!.result, 'failure');
});

test('audit: running + ts3 unreachable ⇒ ts3.unreachable event', () => {
  const actions = buildManagedHealthAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    containerRunning: true,
    ts3: 'unreachable',
    outcome: 'completed',
  }).map((e) => e.action);
  assert.deepEqual(actions, [
    'healthcheck.managed.requested',
    'healthcheck.container.running',
    'healthcheck.ts3.unreachable',
    'healthcheck.managed.completed',
  ]);
});

test('audit entries never contain secrets or raw output', () => {
  const combos = [
    { containerRunning: true, ts3: 'reachable' as const, outcome: 'completed' as const },
    { containerRunning: false, ts3: null, outcome: 'failed' as const },
  ];
  for (const c of combos) {
    const s = JSON.stringify(buildManagedHealthAuditEntries({ actor: 'o@e.com', serverId: 'srv-7', ...c }));
    assert.ok(!/password|secret|token|serveradmin|virtualserver_/i.test(s));
  }
});

test('managed-health sources contain no docker commands / no log reading / no socket', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = ['managed-health.ts', 'managed-health-helpers.ts'].map((f) =>
    readFileSync(join(coreDir, f), 'utf8'),
  );
  const forbidden = [
    'docker inspect',
    'docker logs',
    'docker exec',
    'docker start',
    'docker run',
    'docker create',
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
