import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildServerArchiveAuditEntries,
  mapArchiveGuard,
} from '../src/core/server-archive-helpers';

const FULL = {
  confirmServerRecordArchive: true,
  credentialDecision: 'keep' as const,
  typedConfirmation: 'ARCHIVE SERVER',
};

test('archive guard: only RESOURCES_PREPARED with all confirmations passes', () => {
  assert.equal(mapArchiveGuard('RESOURCES_PREPARED', FULL), 'ok');
  assert.equal(mapArchiveGuard('RUNNING', FULL), 'invalidState');
  assert.equal(mapArchiveGuard('CONTAINER_CREATED', FULL), 'invalidState');
  assert.equal(mapArchiveGuard('CONTAINER_PENDING', FULL), 'invalidState');
  assert.equal(mapArchiveGuard('DRAFT', FULL), 'invalidState');
  assert.equal(mapArchiveGuard(null, FULL), 'invalidState');
});

test('archive guard: missing archive confirmation blocks', () => {
  assert.equal(
    mapArchiveGuard('RESOURCES_PREPARED', { ...FULL, confirmServerRecordArchive: false }),
    'archiveConfirmRequired',
  );
});

test('archive guard: missing credential decision blocks', () => {
  assert.equal(
    mapArchiveGuard('RESOURCES_PREPARED', {
      confirmServerRecordArchive: true,
      typedConfirmation: 'ARCHIVE SERVER',
    }),
    'credentialDecisionRequired',
  );
});

test('archive guard: wrong/empty typed confirmation blocks', () => {
  assert.equal(mapArchiveGuard('RESOURCES_PREPARED', { ...FULL, typedConfirmation: 'nope' }), 'typedMismatch');
  assert.equal(mapArchiveGuard('RESOURCES_PREPARED', { ...FULL, typedConfirmation: '' }), 'typedMismatch');
});

test('archive guard: both credential decisions are accepted', () => {
  assert.equal(mapArchiveGuard('RESOURCES_PREPARED', { ...FULL, credentialDecision: 'keep' }), 'ok');
  assert.equal(mapArchiveGuard('RESOURCES_PREPARED', { ...FULL, credentialDecision: 'remove' }), 'ok');
});

test('audit: archived + keep ⇒ keepConfirmed, no credentials.removed', () => {
  const actions = buildServerArchiveAuditEntries({
    actor: 'owner@example.com',
    serverId: 'srv-7',
    outcome: 'archived',
    credentialDecision: 'keep',
  }).map((e) => e.action);
  assert.deepEqual(actions, [
    'deprovision.serverArchive.requested',
    'deprovision.serverArchive.confirmed',
    'deprovision.credentials.keepConfirmed',
    'deprovision.server.archived',
    'deprovision.serverArchive.completed',
  ]);
  assert.ok(!actions.includes('deprovision.credentials.removed'));
});

test('audit: archived + remove ⇒ removeConfirmed + credentials.removed', () => {
  const actions = buildServerArchiveAuditEntries({
    actor: 'o@e.com',
    serverId: 'srv-7',
    outcome: 'archived',
    credentialDecision: 'remove',
  }).map((e) => e.action);
  assert.deepEqual(actions, [
    'deprovision.serverArchive.requested',
    'deprovision.serverArchive.confirmed',
    'deprovision.credentials.removeConfirmed',
    'deprovision.credentials.removed',
    'deprovision.server.archived',
    'deprovision.serverArchive.completed',
  ]);
});

test('audit: blocked ⇒ requested + blocked (no confirmed)', () => {
  const actions = buildServerArchiveAuditEntries({ actor: 'o@e.com', serverId: 'srv-7', outcome: 'blocked' }).map(
    (e) => e.action,
  );
  assert.deepEqual(actions, ['deprovision.serverArchive.requested', 'deprovision.serverArchive.blocked']);
});

test('audit entries never contain secrets', () => {
  const combos = [
    { outcome: 'archived' as const, credentialDecision: 'keep' as const },
    { outcome: 'archived' as const, credentialDecision: 'remove' as const },
    { outcome: 'blocked' as const },
  ];
  for (const c of combos) {
    const s = JSON.stringify(buildServerArchiveAuditEntries({ actor: 'o@e.com', serverId: 'srv-7', ...c }));
    assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY|encrypted/i.test(s));
  }
});

test('server-archive code makes no Docker/agent calls (pure DB step)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = ['server-archive.ts', 'server-archive-helpers.ts'].map((f) =>
    readFileSync(join(coreDir, f), 'utf8'),
  );
  const forbidden = [
    'agent-client',
    'AGENT_URL',
    'execFile',
    'docker rm',
    'volume rm',
    'network rm',
    'docker.sock',
  ];
  for (const src of sources) {
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token present: ${token}`);
    }
  }
});
