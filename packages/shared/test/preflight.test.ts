import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ResourceSnapshot } from '@speakcore/types';
import {
  calculateOverallPreflightStatus,
  combineFindings,
  evaluateCpu,
  evaluateEnvironment,
  evaluateIpStack,
  evaluateMemory,
  evaluateServiceSuitability,
  evaluateStorage,
  runPreflight,
  worstSeverity,
} from '../src/preflight';

const full: ResourceSnapshot = {
  cpuCores: 4,
  ramGb: 16,
  freeStorageGb: 200,
  uploadMbps: 50,
  docker: 'present',
  dockerCompose: 'present',
  firewall: 'present',
  dns: 'present',
  ipv4: true,
  backupStorageGb: 50,
};

test('CPU: meets profile → green, below floor → red, unknown → yellow', () => {
  assert.equal(evaluateCpu({ cpuCores: 4 }, 'medium').severity, 'green');
  assert.equal(evaluateCpu({ cpuCores: 1 }, 'small').severity, 'red');
  const unknown = evaluateCpu({}, 'small');
  assert.equal(unknown.severity, 'yellow');
  assert.equal(unknown.limiting, true);
});

test('RAM: 4GB meets small (green) but not medium (yellow/red)', () => {
  assert.equal(evaluateMemory({ ramGb: 4 }, 'small').severity, 'green');
  assert.equal(evaluateMemory({ ramGb: 4 }, 'medium').severity, 'yellow');
  assert.equal(evaluateMemory({ ramGb: 1 }, 'small').severity, 'red');
});

test('Storage: grading against profile', () => {
  assert.equal(evaluateStorage({ freeStorageGb: 200 }, 'large').severity, 'green');
  assert.equal(evaluateStorage({ freeStorageGb: 10 }, 'small').severity, 'red');
});

test('Environment: VM green, LXC yellow+limiting, unknown yellow not green', () => {
  assert.equal(evaluateEnvironment('proxmox-vm').severity, 'green');
  const lxc = evaluateEnvironment('proxmox-lxc');
  assert.equal(lxc.severity, 'yellow');
  assert.equal(lxc.limiting, true);
  assert.equal(lxc.detailKey, 'lxcExpert');
  assert.equal(evaluateEnvironment('unknown').severity, 'yellow');
});

test('IP stack: ipv4 green, ipv6-only yellow, none red, unknown yellow', () => {
  assert.equal(evaluateIpStack({ ipv4: true }).severity, 'green');
  assert.equal(evaluateIpStack({ ipv4: false, ipv6: true }).severity, 'yellow');
  assert.equal(evaluateIpStack({ ipv4: false, ipv6: false }).severity, 'red');
  assert.equal(evaluateIpStack({}).severity, 'yellow');
});

test('overall status is the worst finding', () => {
  assert.equal(worstSeverity(['green', 'yellow', 'green']), 'yellow');
  assert.equal(worstSeverity(['green', 'red', 'yellow']), 'red');
  const findings = combineFindings(
    [evaluateEnvironment('proxmox-vm')],
    [evaluateCpu({ cpuCores: 1 }, 'small')],
  );
  assert.equal(calculateOverallPreflightStatus(findings), 'red');
});

test('TS3 suitability across small/medium/large snapshots', () => {
  const ts3 = (s: ResourceSnapshot) =>
    evaluateServiceSuitability(s).find((x) => x.service === 'teamspeak3')!;
  assert.equal(ts3({ ramGb: 4, cpuCores: 2 }).severity, 'green'); // small
  assert.equal(ts3({ ramGb: 8, cpuCores: 4 }).severity, 'green'); // medium
  assert.equal(ts3({ ramGb: 16, cpuCores: 8 }).severity, 'green'); // large
  assert.equal(ts3({ ramGb: 1, cpuCores: 1 }).severity, 'red'); // too small
  assert.equal(ts3({}).severity, 'yellow'); // unknown → not green
  assert.equal(ts3({ ramGb: 4, cpuCores: 2 }).available, true);
});

test('heavy services (matrix/jitsi) only roadmap and not green on small specs', () => {
  const s = evaluateServiceSuitability({ ramGb: 4, cpuCores: 2 });
  const matrix = s.find((x) => x.service === 'matrix')!;
  const jitsi = s.find((x) => x.service === 'jitsi')!;
  assert.equal(matrix.available, false);
  assert.equal(jitsi.available, false);
  assert.equal(matrix.severity, 'red');
  assert.equal(jitsi.severity, 'red');
});

test('unknown data never yields an overall green', () => {
  const result = runPreflight({ environment: 'unknown', profile: 'small', snapshot: {} });
  assert.notEqual(result.overall, 'green');
});

test('runPreflight: LXC + 4GB RAM + unknown upload → yellow with LXC + network limiting', () => {
  const result = runPreflight({
    environment: 'proxmox-lxc',
    profile: 'small',
    snapshot: {
      cpuCores: 2,
      ramGb: 4,
      freeStorageGb: 40,
      docker: 'present',
      dockerCompose: 'present',
      firewall: 'present',
      dns: 'present',
      ipv4: true,
      backupStorageGb: 20,
    },
  });
  assert.equal(result.overall, 'yellow');
  const limitingCats = result.limitingFactors.map((f) => f.category);
  assert.ok(limitingCats.includes('environment'));
  assert.ok(limitingCats.includes('network'));
  // TS3 ist geeignet, Matrix/Jitsi nicht empfohlen
  assert.ok(result.recommendation.suitableServices.includes('teamspeak3'));
  assert.ok(result.recommendation.notRecommended.includes('matrix'));
  // LXC erzeugt die VM-Empfehlung
  assert.ok(result.upgrades.some((u) => u.key === 'useVm'));
});

test('full healthy snapshot on a VM → green overall', () => {
  const result = runPreflight({ environment: 'proxmox-vm', profile: 'medium', snapshot: full });
  assert.equal(result.overall, 'green');
  assert.deepEqual(result.upgrades, []);
});
