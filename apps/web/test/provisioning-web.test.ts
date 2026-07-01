import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ManagedResourceResult } from '@speakcore/types';
import {
  buildProvisionAuditEntries,
  buildProvisionInput,
  isOwner,
  type WebPrepareResult,
} from '../src/core/provisioning-helpers';

test('isOwner: only OWNER passes', () => {
  assert.equal(isOwner({ role: 'OWNER' }), true);
  assert.equal(isOwner({ role: 'admin' }), false);
  assert.equal(isOwner(null), false);
  assert.equal(isOwner(undefined), false);
});

test('buildProvisionInput fixes image/restart and sets no forbidden fields', () => {
  const input = buildProvisionInput({
    instanceId: 'clabc123def456',
    displayName: 'My Community',
    voicePort: 9987,
    queryPort: 10011,
    fileTransferPort: 30033,
    mode: 'simple',
  });
  assert.equal(input.imageName, 'teamspeak');
  assert.equal(input.restartPolicy, 'unless-stopped');
  for (const forbidden of ['privileged', 'mountDockerSocket', 'hostMounts', 'dockerArgs']) {
    assert.equal(forbidden in input, false, forbidden);
  }
});

function result(
  status: WebPrepareResult['status'],
  resources: ManagedResourceResult[] = [],
): WebPrepareResult {
  return { status, resources, instanceId: 'inst-123' };
}

test('audit entries: ok with created/exists', () => {
  const entries = buildProvisionAuditEntries(
    result('ok', [
      { kind: 'network', name: 'speakcore-network-voice', outcome: 'created' },
      { kind: 'volume', name: 'speakcore-volume-ts3-x', outcome: 'exists' },
    ]),
    'owner@example.com',
  );
  const actions = entries.map((e) => e.action);
  assert.ok(actions.includes('docker.prepare.requested'));
  assert.ok(actions.includes('docker.network.created'));
  assert.ok(actions.includes('docker.volume.exists'));
  for (const e of entries) {
    assert.equal(e.actor, 'owner@example.com');
    assert.equal(e.target, 'inst-123');
  }
});

test('audit entries map conflict/writeDisabled/unreachable', () => {
  assert.ok(
    buildProvisionAuditEntries(
      result('conflict', [{ kind: 'network', name: 'x', outcome: 'conflict' }]),
      'o@e.com',
    )
      .map((e) => e.action)
      .includes('docker.prepare.conflict'),
  );
  assert.ok(
    buildProvisionAuditEntries(result('writeDisabled'), 'o@e.com')
      .map((e) => e.action)
      .includes('docker.prepare.writeDisabled'),
  );
  assert.ok(
    buildProvisionAuditEntries(result('unreachable'), 'o@e.com')
      .map((e) => e.action)
      .includes('docker.prepare.unavailable'),
  );
});

test('audit entries never contain secrets', () => {
  const entries = buildProvisionAuditEntries(
    result('ok', [{ kind: 'network', name: 'speakcore-network-voice', outcome: 'created' }]),
    'owner@example.com',
  );
  assert.ok(!/password|secret|token|admin/i.test(JSON.stringify(entries)));
});

test('web provisioning code does not talk to docker or the agent directly', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const webDir = join(here, '..', 'src');
  const files = [
    join(webDir, 'core', 'provisioning.ts'),
    join(webDir, 'core', 'provisioning-helpers.ts'),
    join(webDir, 'app', '[locale]', 'servers', 'provision', 'actions.ts'),
  ].map((f) => readFileSync(f, 'utf8'));

  const forbidden = ['docker run', 'docker start', 'docker rm', 'docker inspect', 'docker.sock', 'execFile'];
  for (const src of files) {
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token present: ${token}`);
    }
    // Direkter Agent-Zugriff nur über lib/agent-client – nicht hier.
    assert.ok(!src.includes('AGENT_URL'), 'no direct AGENT_URL usage');
  }
});
