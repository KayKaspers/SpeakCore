import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SystemInfo } from '@speakcore/types';
import { runPreflight } from '@speakcore/shared';
import { isSnapshotComplete, mapSystemInfoToResourceSnapshot } from '../src/core/system-snapshot';

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

test('un-probed factors (network/firewall/dns) keep overall non-green on strong hardware', () => {
  // Selbst auf starker Hardware bleibt die Bewertung gelb, weil Netzwerk/Firewall/DNS in Step 006
  // nicht erhoben werden (unbekannt ⇒ nie grün).
  const s = mapSystemInfoToResourceSnapshot(makeInfo({ cpuCores: 8, memory: { totalGb: 32 } }));
  const r = runPreflight({ environment: 'unknown', profile: 'small', snapshot: s });
  assert.notEqual(r.overall, 'green');
});
