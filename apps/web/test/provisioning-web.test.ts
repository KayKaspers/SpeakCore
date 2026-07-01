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
  provisioningErrorKey,
  resolveProvisioningStatus,
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

test('audit entries: ok yields requested + resource events + completed, linked to serverId', () => {
  const r: WebPrepareResult = {
    status: 'ok',
    instanceId: 'inst-123',
    serverId: 'srv-9',
    resources: [
      { kind: 'network', name: 'speakcore-network-voice', outcome: 'created' },
      { kind: 'volume', name: 'speakcore-volume-ts3-x', outcome: 'exists' },
    ],
  };
  const entries = buildProvisionAuditEntries(r, 'owner@example.com');
  const actions = entries.map((e) => e.action);
  assert.ok(actions.includes('docker.prepare.requested'));
  assert.ok(actions.includes('docker.network.created'));
  assert.ok(actions.includes('docker.volume.exists'));
  assert.ok(actions.includes('docker.prepare.completed'));
  // Verknüpfung mit ServerInstance-ID.
  for (const e of entries) {
    assert.equal(e.actor, 'owner@example.com');
    assert.equal(e.target, 'srv-9');
  }
});

test('audit entries: failures yield docker.prepare.failed (+ resource conflict)', () => {
  const conflict = buildProvisionAuditEntries(
    result('conflict', [{ kind: 'network', name: 'x', outcome: 'conflict' }]),
    'o@e.com',
  ).map((e) => e.action);
  assert.ok(conflict.includes('docker.network.conflict'));
  assert.ok(conflict.includes('docker.prepare.failed'));

  for (const status of ['writeDisabled', 'unavailable', 'unreachable', 'invalid'] as const) {
    assert.ok(
      buildProvisionAuditEntries(result(status), 'o@e.com')
        .map((e) => e.action)
        .includes('docker.prepare.failed'),
      status,
    );
  }
});

test('resolveProvisioningStatus maps web status to persistent state', () => {
  assert.equal(resolveProvisioningStatus('ok'), 'RESOURCES_PREPARED');
  assert.equal(resolveProvisioningStatus('partial'), 'RESOURCE_PREPARE_PARTIAL');
  assert.equal(resolveProvisioningStatus('conflict'), 'RESOURCE_PREPARE_FAILED');
  assert.equal(resolveProvisioningStatus('invalid'), 'RESOURCE_PREPARE_FAILED');
  // Umgebungszustände: kein irreführender „prepared"-Status.
  assert.equal(resolveProvisioningStatus('writeDisabled'), 'DRAFT');
  assert.equal(resolveProvisioningStatus('unavailable'), 'DRAFT');
  assert.equal(resolveProvisioningStatus('unreachable'), 'DRAFT');
});

test('provisioningErrorKey returns generic keys (no detail) or null', () => {
  assert.equal(provisioningErrorKey('writeDisabled'), 'writeDisabled');
  assert.equal(provisioningErrorKey('unreachable'), 'unreachable');
  assert.equal(provisioningErrorKey('conflict'), 'conflict');
  assert.equal(provisioningErrorKey('ok'), null);
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
