import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { DeprovisionConfirmations, DeprovisionResourceState } from '@speakcore/types';
import {
  DEPROVISION_AUDIT,
  buildDeprovisioningPlan,
  canRemoveManagedNetwork,
  canRemoveManagedVolume,
  validateDeprovisioningRequest,
} from '../src/provisioning';

const INSTANCE = 'clabc123def456';

function baseState(overrides: Partial<DeprovisionResourceState> = {}): DeprovisionResourceState {
  return {
    instanceId: INSTANCE,
    provisioningStatus: 'RESOURCES_PREPARED',
    runState: 'unknown',
    container: { exists: false, running: false },
    volume: { exists: true, managed: true },
    network: { exists: true, managed: true, inUseByOthers: false },
    ...overrides,
  };
}

const fullVolumeConfirm: DeprovisionConfirmations = {
  confirmVolumeDataLoss: true,
  confirmBackupRecommended: true,
};

test('volume remove blocked while container still exists', () => {
  const g = canRemoveManagedVolume(
    baseState({ container: { exists: true, running: false } }),
    fullVolumeConfirm,
  );
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('containerStillExists'));
});

test('volume remove blocked without data-loss confirmation', () => {
  const g = canRemoveManagedVolume(baseState(), { confirmBackupRecommended: true });
  assert.equal(g.allowed, false);
  assert.ok(g.requiredConfirmations.includes('confirmVolumeDataLoss'));
});

test('volume remove blocked without backup confirmation', () => {
  const g = canRemoveManagedVolume(baseState(), { confirmVolumeDataLoss: true });
  assert.equal(g.allowed, false);
  assert.ok(g.requiredConfirmations.includes('confirmBackupRecommended'));
});

test('volume remove allowed in plan only for managed volume + no container + confirmations', () => {
  const g = canRemoveManagedVolume(baseState(), fullVolumeConfirm);
  assert.equal(g.allowed, true);
  assert.deepEqual(g.blockedReasons, []);
});

test('volume remove blocked for unmanaged (foreign) volume regardless of confirmations', () => {
  const g = canRemoveManagedVolume(
    baseState({ volume: { exists: true, managed: false } }),
    { ...fullVolumeConfirm, typedConfirmation: 'DELETE VOLUME' },
  );
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('volumeNotManaged'));
});

test('volume remove blocked on typed-confirmation mismatch', () => {
  const g = canRemoveManagedVolume(baseState(), { ...fullVolumeConfirm, typedConfirmation: 'nope' });
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('typedConfirmationMismatch'));
});

test('network remove blocked while container exists', () => {
  const g = canRemoveManagedNetwork(
    baseState({ container: { exists: true, running: false } }),
    { confirmNetworkUnused: true },
  );
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('containerStillExists'));
});

test('network remove blocked when network is not managed', () => {
  const g = canRemoveManagedNetwork(
    baseState({ network: { exists: true, managed: false, inUseByOthers: false } }),
    { confirmNetworkUnused: true },
  );
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('networkNotManaged'));
});

test('network remove blocked when still used by other managed containers', () => {
  const g = canRemoveManagedNetwork(
    baseState({ network: { exists: true, managed: true, inUseByOthers: true } }),
    { confirmNetworkUnused: true },
  );
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes('networkInUse'));
});

test('foreign resources are never planned as executable', () => {
  const evalVol = validateDeprovisioningRequest({
    scope: 'volume',
    state: baseState({ volume: { exists: true, managed: false } }),
    confirmations: fullVolumeConfirm,
  });
  assert.equal(evalVol.decision, 'blocked');
  assert.equal(evalVol.executable, false);
  const evalNet = validateDeprovisioningRequest({
    scope: 'network',
    state: baseState({ network: { exists: true, managed: false, inUseByOthers: false } }),
    confirmations: { confirmNetworkUnused: true },
  });
  assert.equal(evalNet.decision, 'blocked');
  assert.equal(evalNet.executable, false);
});

test('evaluation is never executable and volume carries dataLossRisk', () => {
  const evalVol = validateDeprovisioningRequest({
    scope: 'volume',
    state: baseState(),
    confirmations: fullVolumeConfirm,
  });
  assert.equal(evalVol.executable, false);
  assert.equal(evalVol.decision, 'allowed');
  assert.equal(evalVol.dataLossRisk, true);
  assert.ok(evalVol.rollbackLimitations.includes('volumeRemovalIrreversible'));
  assert.ok(evalVol.auditEvents.includes(DEPROVISION_AUDIT.volumeRemoved));
});

test('buildDeprovisioningPlan covers all stages and never executes', () => {
  const plan = buildDeprovisioningPlan(baseState(), fullVolumeConfirm);
  assert.equal(plan.length, 4);
  assert.deepEqual(
    plan.map((p) => p.scope),
    ['containerOnly', 'volume', 'network', 'serverRecord'],
  );
  for (const e of plan) assert.equal(e.executable, false);
});

test('plan/evaluation contains no secrets', () => {
  const plan = buildDeprovisioningPlan(baseState(), fullVolumeConfirm);
  assert.ok(!/password|secret|token|serveradmin|TS3SERVERQUERY/i.test(JSON.stringify(plan)));
});

test('deprovision source contains no docker write commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'provisioning', 'deprovision.ts'), 'utf8');
  const forbidden = [
    'docker volume rm',
    'docker network rm',
    'docker rm',
    'volume rm',
    'network rm',
    'rm -f',
    'execFile',
    'docker.sock',
    'prisma',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
});
