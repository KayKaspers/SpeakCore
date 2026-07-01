import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MANAGED_QUERY_USERNAME, generateSecret } from '../src/core/secret-generator';
import {
  buildContainerPrepareAuditEntries,
  resolveContainerPrepare,
} from '../src/core/container-prepare-helpers';

test('generateSecret: alphanumeric, correct length, unique', () => {
  const s = generateSecret(32);
  assert.equal(s.length, 32);
  assert.match(s, /^[A-Za-z0-9]+$/); // keine Sonderzeichen (Shell/ENV-sicher)
  assert.equal(generateSecret(4).length, 16); // Mindestlänge erzwungen
  assert.notEqual(generateSecret(32), generateSecret(32));
});

test('managed query username is fixed server-side', () => {
  assert.equal(MANAGED_QUERY_USERNAME, 'serveradmin');
});

test('resolveContainerPrepare status guard', () => {
  assert.equal(resolveContainerPrepare('RESOURCES_PREPARED'), 'ok');
  assert.equal(resolveContainerPrepare('CONTAINER_PENDING'), 'alreadyPending');
  assert.equal(resolveContainerPrepare('DRAFT'), 'invalidState');
  assert.equal(resolveContainerPrepare('RESOURCE_PREPARE_FAILED'), 'invalidState');
  assert.equal(resolveContainerPrepare(null), 'invalidState');
});

test('audit entries: completed + secretCreated, linked to serverId, no secrets', () => {
  const entries = buildContainerPrepareAuditEntries('completed', 'owner@example.com', 'srv-7', true);
  const actions = entries.map((e) => e.action);
  assert.deepEqual(actions, [
    'ts3.containerPrepare.requested',
    'ts3.containerPrepare.secretCreated',
    'ts3.containerPrepare.completed',
  ]);
  for (const e of entries) assert.equal(e.target, 'srv-7');
  assert.ok(!/password|secret=|token|serveradmin|[A-Za-z0-9]{24,}/.test(JSON.stringify(entries).replace('secretCreated', '')));
});

test('audit entries: failed has no secretCreated event', () => {
  const actions = buildContainerPrepareAuditEntries('failed', 'o@e.com', 'srv-7', false).map((e) => e.action);
  assert.deepEqual(actions, ['ts3.containerPrepare.requested', 'ts3.containerPrepare.failed']);
});

test('container-prepare sources contain no docker/agent calls', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = ['container-prepare.ts', 'container-prepare-helpers.ts', 'secret-generator.ts'].map(
    (f) => readFileSync(join(coreDir, f), 'utf8'),
  );
  const forbidden = ['docker ', 'AGENT_URL', 'execFile', 'prepareManagedResources', 'fetch('];
  for (const src of sources) {
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token present: ${token}`);
    }
  }
});
