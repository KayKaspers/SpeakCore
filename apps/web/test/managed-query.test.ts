import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveConfiguredQueryHost,
  resolveTs3CheckMode,
} from '../src/core/managed-query-helpers';
import { validateServerHost } from '../src/core/host-validation';
import { buildManagedHealthAuditEntries } from '../src/core/managed-health-helpers';

test('resolveConfiguredQueryHost: UI input wins, else env default, else null (no guessing)', () => {
  assert.equal(resolveConfiguredQueryHost('1.2.3.4', '10.0.0.5'), '1.2.3.4'); // UI override
  assert.equal(resolveConfiguredQueryHost('', '10.0.0.5'), '10.0.0.5'); // env default
  assert.equal(resolveConfiguredQueryHost('  ', '10.0.0.5'), '10.0.0.5'); // whitespace → env
  assert.equal(resolveConfiguredQueryHost('  1.2.3.4  ', null), '1.2.3.4'); // trimmed
  assert.equal(resolveConfiguredQueryHost('', ''), null); // both empty
  assert.equal(resolveConfiguredQueryHost(null, null), null);
});

test('resolveTs3CheckMode: only running + address ⇒ attempt; running w/o address ⇒ notConfigured', () => {
  assert.equal(resolveTs3CheckMode(false, true), 'unknown'); // container not running
  assert.equal(resolveTs3CheckMode(false, false), 'unknown');
  assert.equal(resolveTs3CheckMode(true, false), 'notConfigured'); // running, no address (no guessing)
  assert.equal(resolveTs3CheckMode(true, true), 'attempt');
});

test('host validation blocks metadata/link-local/unspecified, allows LAN/localhost', () => {
  // blocked
  for (const h of ['169.254.169.254', '169.254.10.10', '0.0.0.0', '::']) {
    assert.equal(validateServerHost(h).ok, false, `must block ${h}`);
    assert.equal(validateServerHost(h).errorKey, 'hostBlocked');
  }
  // allowed (self-hosting)
  for (const h of ['127.0.0.1', '192.168.1.20', '10.0.0.5', 'ts3.example.com', 'localhost']) {
    assert.equal(validateServerHost(h).ok, true, `must allow ${h}`);
  }
  // syntactically invalid
  assert.equal(validateServerHost('http://x').ok, false);
  assert.equal(validateServerHost('a b').ok, false);
});

test('health audit: ts3 notConfigured ⇒ healthcheck.ts3.notConfigured event', () => {
  const actions = buildManagedHealthAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    containerRunning: true,
    ts3: 'notConfigured',
    outcome: 'completed',
  }).map((e) => e.action);
  assert.deepEqual(actions, [
    'healthcheck.managed.requested',
    'healthcheck.container.running',
    'healthcheck.ts3.notConfigured',
    'healthcheck.managed.completed',
  ]);
});

test('health audit: reachable/unreachable still map to their events; no secrets', () => {
  const reachable = buildManagedHealthAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    containerRunning: true,
    ts3: 'reachable',
    outcome: 'completed',
  });
  assert.ok(reachable.some((e) => e.action === 'healthcheck.ts3.reachable'));
  const unreachable = buildManagedHealthAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    containerRunning: true,
    ts3: 'unreachable',
    outcome: 'completed',
  });
  assert.ok(unreachable.some((e) => e.action === 'healthcheck.ts3.unreachable'));
  assert.ok(!/password|secret|token|serveradmin|virtualserver_/i.test(JSON.stringify([reachable, unreachable])));
});
