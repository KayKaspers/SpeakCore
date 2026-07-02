import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeServerListView, serverListWhere } from '../src/core/servers-list';

test('normalizeServerListView defaults to active, accepts archived', () => {
  assert.equal(normalizeServerListView(undefined), 'active');
  assert.equal(normalizeServerListView(''), 'active');
  assert.equal(normalizeServerListView('active'), 'active');
  assert.equal(normalizeServerListView('nonsense'), 'active');
  assert.equal(normalizeServerListView('archived'), 'archived');
});

test('active view filters out archived (archivedAt = null)', () => {
  assert.deepEqual(serverListWhere('active'), { archivedAt: null });
});

test('archived view shows only archived (archivedAt != null)', () => {
  assert.deepEqual(serverListWhere('archived'), { archivedAt: { not: null } });
});

test('servers-list is a read-only filter: no docker/agent/write, no secrets', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = join(here, '..', 'src', 'core', 'servers-list.ts');
  const src = readFileSync(file, 'utf8');
  const forbidden = [
    'agent-client',
    'AGENT_URL',
    'execFile',
    'docker',
    'prisma',
    '.delete',
    '.update',
    'password',
    'secret',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
});

test('servers list page has no Docker/agent imports and no lifecycle write actions', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const page = join(here, '..', 'src', 'app', '[locale]', 'servers', 'page.tsx');
  const src = readFileSync(page, 'utf8');
  const forbidden = [
    'agent-client',
    'execFile',
    'docker',
    // keine Lösch-/Lifecycle-Aktionen aus der Liste heraus:
    'removeVolumeAction',
    'removeNetworkAction',
    'removeContainerAction',
    'archiveServerAction',
    'startContainerAction',
    'stopContainerAction',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
});
