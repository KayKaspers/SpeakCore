import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildNetworkRemoveAuditEntries,
  mapNetworkConfirmationGuard,
} from '../src/core/network-remove-helpers';

test('confirmation guard: confirmNetworkUnused required', () => {
  assert.equal(mapNetworkConfirmationGuard({ confirmNetworkUnused: true }), 'ok');
  assert.equal(mapNetworkConfirmationGuard({}), 'confirmationRequired');
  assert.equal(mapNetworkConfirmationGuard({ confirmNetworkUnused: false }), 'confirmationRequired');
});

test('audit: removed ⇒ requested + confirmed + network.removed + completed', () => {
  const actions = buildNetworkRemoveAuditEntries({
    actor: 'owner@example.com',
    serverId: 'srv-7',
    confirmed: true,
    outcome: 'removed',
  }).map((e) => e.action);
  assert.deepEqual(actions, [
    'deprovision.networkRemove.requested',
    'deprovision.networkRemove.confirmed',
    'deprovision.network.removed',
    'deprovision.networkRemove.completed',
  ]);
});

test('audit: alreadyRemoved ⇒ idempotent completed', () => {
  const actions = buildNetworkRemoveAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    confirmed: true,
    outcome: 'alreadyRemoved',
  }).map((e) => e.action);
  assert.deepEqual(actions, [
    'deprovision.networkRemove.requested',
    'deprovision.networkRemove.confirmed',
    'deprovision.network.alreadyRemoved',
    'deprovision.networkRemove.completed',
  ]);
});

test('audit: inUse ⇒ inUse + failed (both failure)', () => {
  const entries = buildNetworkRemoveAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    confirmed: true,
    outcome: 'inUse',
  });
  assert.deepEqual(
    entries.map((e) => e.action),
    [
      'deprovision.networkRemove.requested',
      'deprovision.networkRemove.confirmed',
      'deprovision.networkRemove.inUse',
      'deprovision.networkRemove.failed',
    ],
  );
  assert.equal(entries[2].result, 'failure');
});

test('audit: web-side block (no confirmed event)', () => {
  const actions = buildNetworkRemoveAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    confirmed: false,
    outcome: 'blocked',
  }).map((e) => e.action);
  assert.deepEqual(actions, ['deprovision.networkRemove.requested', 'deprovision.networkRemove.blocked']);
  assert.ok(!actions.includes('deprovision.networkRemove.confirmed'));
});

test('audit: conflict ⇒ conflict + failed', () => {
  const actions = buildNetworkRemoveAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    confirmed: true,
    outcome: 'conflict',
  }).map((e) => e.action);
  assert.deepEqual(actions, [
    'deprovision.networkRemove.requested',
    'deprovision.networkRemove.confirmed',
    'deprovision.networkRemove.conflict',
    'deprovision.networkRemove.failed',
  ]);
});

test('audit entries never contain secrets', () => {
  for (const outcome of ['removed', 'alreadyRemoved', 'inUse', 'conflict', 'blocked', 'failed'] as const) {
    const s = JSON.stringify(
      buildNetworkRemoveAuditEntries({ actor: 'o@e.com', serverId: 'srv-7', confirmed: true, outcome }),
    );
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(s));
  }
});

test('Option A: network-remove writes no ServerInstance status field, no docker commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = ['network-remove.ts', 'network-remove-helpers.ts'].map((f) =>
    readFileSync(join(coreDir, f), 'utf8'),
  );
  const forbidden = [
    'serverInstance.update',
    'network rm',
    'volume rm',
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
