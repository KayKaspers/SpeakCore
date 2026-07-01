import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Ts3ServerStatus } from '../src/core/ts3/protocol';
import { statusToServerUpdate } from '../src/core/servers-status';

const NOW = new Date('2026-07-01T10:00:00.000Z');

test('reachable status maps to a full snapshot', () => {
  const status: Ts3ServerStatus = {
    reachable: true,
    name: 'My Server',
    version: '3.13.7',
    platform: 'Linux',
    clientsOnline: 5,
    maxClients: 32,
    uptimeSeconds: 3600,
  };
  const u = statusToServerUpdate(status, NOW);
  assert.equal(u.lastStatus, 'reachable');
  assert.equal(u.runState, 'connected');
  assert.equal(u.statusMessageKey, null);
  assert.equal(u.statusName, 'My Server');
  assert.equal(u.statusClientsOnline, 5);
  assert.equal(u.lastConnectedAt, NOW);
});

test('unreachable status stores generic error only, keeps prior snapshot', () => {
  const u = statusToServerUpdate({ reachable: false }, NOW);
  assert.equal(u.lastStatus, 'unreachable');
  assert.equal(u.runState, 'error');
  assert.equal(u.statusMessageKey, 'connectionFailed');
  // Kein lastConnectedAt-Update und kein Snapshot-Überschreiben bei Fehler.
  assert.equal('lastConnectedAt' in u, false);
  assert.equal('statusName' in u, false);
});

test('update never contains secret-like fields', () => {
  const keys = Object.keys(statusToServerUpdate({ reachable: true, name: 'x' }, NOW));
  const forbidden = ['username', 'password', 'encryptedUsername', 'encryptedPassword', 'credential'];
  for (const k of keys) {
    assert.ok(!forbidden.includes(k), `unexpected secret-like key: ${k}`);
    assert.ok(!/pass|secret|token|cred/i.test(k), `suspicious key: ${k}`);
  }
});
