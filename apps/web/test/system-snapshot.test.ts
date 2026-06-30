import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SystemInfo } from '@speakcore/types';
import { runPreflight } from '@speakcore/shared';
import {
  isSnapshotComplete,
  mapDetectedEnvironment,
  mapSystemInfoToResourceSnapshot,
} from '../src/core/system-snapshot';

function makeInfo(overrides: Partial<SystemInfo> = {}): SystemInfo {
  return {
    agentVersion: '0.1.0',
    nodeVersion: 'v24.0.0',
    os: { platform: 'linux', release: '6.1.0', type: 'Linux' },
    arch: 'x64',
    cpuCores: 4,
    memory: { totalGb: 16, freeGb: 8 },
    dataPathStorageGb: 200,
    docker: { available: 'present', version: 'Docker version 27.0' },
    dockerCompose: { available: 'present', version: 'Docker Compose version v2.29' },
    environment: { kind: 'vm', virtualization: 'kvm', confident: true },
    network: {
      hasIpv4: true,
      hasIpv6: false,
      hasExternalInterface: true,
      externalInterfaceCount: 1,
      dns: { configured: 'present', serverCount: 2 },
    },
    collectedAt: new Date().toISOString(),
    ...overrides,
  };
}

test('maps core fields from agent SystemInfo', () => {
  const s = mapSystemInfoToResourceSnapshot(makeInfo());
  assert.equal(s.cpuCores, 4);
  assert.equal(s.ramGb, 16);
  assert.equal(s.freeStorageGb, 200);
  assert.equal(s.docker, 'present');
  assert.equal(s.dockerCompose, 'present');
  assert.equal(s.os, 'linux 6.1.0');
});

test('docker unknown maps through and never yields overall green', () => {
  const s = mapSystemInfoToResourceSnapshot(
    makeInfo({ docker: { available: 'unknown' }, dockerCompose: { available: 'unknown' } }),
  );
  assert.equal(s.docker, 'unknown');
  const r = runPreflight({ environment: 'unknown', profile: 'small', snapshot: s });
  assert.notEqual(r.overall, 'green');
});

test('missing storage → freeStorageGb undefined and snapshot incomplete', () => {
  const info = makeInfo();
  delete info.dataPathStorageGb;
  const s = mapSystemInfoToResourceSnapshot(info);
  assert.equal(s.freeStorageGb, undefined);
  assert.equal(isSnapshotComplete(s), false);
});

test('complete snapshot is reported complete', () => {
  assert.equal(isSnapshotComplete(mapSystemInfoToResourceSnapshot(makeInfo())), true);
});

test('un-probed factors (network upload/firewall) keep overall non-green on strong hardware', () => {
  // Auch mit erkannter Umgebung/IP/DNS bleibt die Bewertung gelb, weil Upload/Firewall in 0.1
  // nicht erhoben werden (unbekannt ⇒ nie grün).
  const s = mapSystemInfoToResourceSnapshot(makeInfo({ cpuCores: 8, memory: { totalGb: 32 } }));
  const r = runPreflight({ environment: 'proxmox-vm', profile: 'small', snapshot: s });
  assert.notEqual(r.overall, 'green');
});

test('maps network: IPv4/IPv6 presence and DNS status', () => {
  const s = mapSystemInfoToResourceSnapshot(makeInfo());
  assert.equal(s.ipv4, true);
  assert.equal(s.ipv6, false);
  assert.equal(s.dns, 'present');
});

test('DNS unknown maps through and never yields overall green', () => {
  const info = makeInfo({
    network: {
      hasIpv4: true,
      hasIpv6: false,
      hasExternalInterface: true,
      externalInterfaceCount: 1,
      dns: { configured: 'unknown' },
    },
  });
  const s = mapSystemInfoToResourceSnapshot(info);
  assert.equal(s.dns, 'unknown');
  const r = runPreflight({ environment: 'proxmox-vm', profile: 'small', snapshot: s });
  assert.notEqual(r.overall, 'green');
});

test('no external interface → no IPv4/IPv6 → ipStack is red', () => {
  const info = makeInfo({
    network: {
      hasIpv4: false,
      hasIpv6: false,
      hasExternalInterface: false,
      externalInterfaceCount: 0,
      dns: { configured: 'present' },
    },
  });
  const s = mapSystemInfoToResourceSnapshot(info);
  assert.equal(s.ipv4, false);
  const r = runPreflight({ environment: 'proxmox-vm', profile: 'small', snapshot: s });
  const ip = r.findings.find((f) => f.category === 'ipStack');
  assert.equal(ip?.severity, 'red');
});

test('mapDetectedEnvironment: container → proxmox-lxc (LXC warning), vm → proxmox-vm', () => {
  assert.equal(mapDetectedEnvironment('container'), 'proxmox-lxc');
  assert.equal(mapDetectedEnvironment('vm'), 'proxmox-vm');
  assert.equal(mapDetectedEnvironment('bare-metal'), 'bare-metal');
  assert.equal(mapDetectedEnvironment('unknown'), 'unknown');
});

test('container environment yields a yellow, limiting environment finding', () => {
  const env = mapDetectedEnvironment('container');
  const r = runPreflight({
    environment: env,
    profile: 'small',
    snapshot: mapSystemInfoToResourceSnapshot(makeInfo()),
  });
  const envFinding = r.findings.find((f) => f.category === 'environment');
  assert.equal(envFinding?.severity, 'yellow');
  assert.equal(envFinding?.limiting, true);
});
