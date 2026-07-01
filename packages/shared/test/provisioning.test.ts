import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Ts3ProvisionInput } from '@speakcore/types';
import {
  ALLOWED_AGENT_ACTIONS,
  LABEL_MANAGED,
  createTs3ProvisioningPlan,
  validateTs3ProvisionInput,
} from '../src/provisioning';

function baseInput(overrides: Partial<Ts3ProvisionInput> = {}): Ts3ProvisionInput {
  return {
    instanceId: 'clabc123def456',
    displayName: 'My Community',
    voicePort: 9987,
    queryPort: 10011,
    fileTransferPort: 30033,
    imageName: 'teamspeak',
    restartPolicy: 'unless-stopped',
    mode: 'simple',
    ...overrides,
  };
}

test('plan builds expected managed names, labels and ports', () => {
  const plan = createTs3ProvisioningPlan(baseInput());
  assert.equal(plan.container.name, 'speakcore-ts3-clabc123def456');
  assert.equal(plan.volumes[0].name, 'speakcore-volume-ts3-clabc123def456');
  assert.equal(plan.networks[0].name, 'speakcore-network-voice');
  assert.equal(plan.labels[LABEL_MANAGED], 'true');
  assert.equal(plan.labels['speakcore.instanceId'], 'clabc123def456');
  const voice = plan.ports.find((p) => p.name === 'voice');
  assert.equal(voice?.hostPort, 9987);
  assert.equal(voice?.protocol, 'udp');
});

test('valid simple-mode input passes validation', () => {
  const r = validateTs3ProvisionInput(baseInput());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test('invalid ports are rejected', () => {
  const r = validateTs3ProvisionInput(baseInput({ voicePort: 70000 }));
  assert.ok(r.errors.some((e) => e.code === 'portInvalid' && e.field === 'voicePort'));
});

test('duplicate ports are rejected', () => {
  const r = validateTs3ProvisionInput(baseInput({ queryPort: 9987 }));
  assert.ok(r.errors.some((e) => e.code === 'portDuplicate'));
});

test('reserved/privileged ports rejected in simple mode, warned in expert', () => {
  const simple = validateTs3ProvisionInput(baseInput({ queryPort: 22 }));
  assert.ok(simple.errors.some((e) => e.code === 'portReserved'));
  const expert = validateTs3ProvisionInput(baseInput({ queryPort: 22, mode: 'expert' }));
  assert.ok(expert.ok);
  assert.ok(expert.warnings.some((w) => w.code === 'portReservedWarning'));
});

test('image outside allowlist is rejected', () => {
  const r = validateTs3ProvisionInput(baseInput({ imageName: 'nginx' }));
  assert.ok(r.errors.some((e) => e.code === 'imageNotAllowed'));
  assert.ok(validateTs3ProvisionInput(baseInput({ imageName: 'teamspeak:3.13.7' })).ok);
});

test('host mounts / path-like volume names are rejected', () => {
  assert.ok(
    validateTs3ProvisionInput(baseInput({ hostMounts: ['/etc:/etc'] })).errors.some(
      (e) => e.code === 'forbiddenHostMounts',
    ),
  );
  assert.ok(
    validateTs3ProvisionInput(baseInput({ dataVolumeName: '/var/run/docker.sock' })).errors.some(
      (e) => e.code === 'volumeNameInvalid',
    ),
  );
});

test('docker socket mount is always rejected', () => {
  for (const mode of ['simple', 'expert'] as const) {
    const r = validateTs3ProvisionInput(baseInput({ mode, mountDockerSocket: true }));
    assert.ok(r.errors.some((e) => e.code === 'forbiddenDockerSocket'), mode);
  }
});

test('privileged container is always rejected', () => {
  for (const mode of ['simple', 'expert'] as const) {
    const r = validateTs3ProvisionInput(baseInput({ mode, privileged: true }));
    assert.ok(r.errors.some((e) => e.code === 'forbiddenPrivileged'), mode);
  }
});

test('raw docker args are rejected', () => {
  const r = validateTs3ProvisionInput(baseInput({ dockerArgs: ['--privileged'] }));
  assert.ok(r.errors.some((e) => e.code === 'forbiddenDockerArgs'));
});

test('rollback and audit plans contain no secret values', () => {
  const plan = createTs3ProvisioningPlan(baseInput());
  const serialized = JSON.stringify([plan.rollback, plan.audit]);
  assert.ok(!/password|secret|token|admin/i.test(serialized));
  // Secret-Anforderungen enthalten nur Meta (kein Wert).
  for (const s of plan.secrets) {
    assert.equal('value' in s, false);
    assert.equal(s.generate, true);
  }
});

test('agent action allowlist covers only the defined managed actions', () => {
  assert.ok(ALLOWED_AGENT_ACTIONS.includes('CREATE_TS3_CONTAINER'));
  assert.ok(!(ALLOWED_AGENT_ACTIONS as readonly string[]).includes('EXEC_ARBITRARY_DOCKER'));
});
