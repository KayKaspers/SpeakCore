import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { gatherSystemInfo } from '../src/system-info';
import { buildServer } from '../src/server';

test('gatherSystemInfo returns safe read-only fields', async () => {
  const info = await gatherSystemInfo();
  assert.ok(info.cpuCores > 0);
  assert.ok(info.memory.totalGb > 0);
  assert.equal(typeof info.nodeVersion, 'string');
  assert.equal(typeof info.arch, 'string');
  assert.ok(['present', 'unknown'].includes(info.docker.available));
  assert.ok(['present', 'unknown'].includes(info.dockerCompose.available));
});

test('docker probe never reports "absent" (unavailable → unknown, no crash)', async () => {
  const info = await gatherSystemInfo();
  assert.notEqual(info.docker.available, 'absent');
  assert.notEqual(info.dockerCompose.available, 'absent');
});

test('GET /system/snapshot returns 200 with cpuCores when no token configured', async () => {
  const server = buildServer({ port: 0, bootstrapToken: null });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://localhost:${port}/system/snapshot`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { cpuCores: number };
    assert.ok(body.cpuCores > 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('GET /system/snapshot requires a valid token when one is configured', async () => {
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token' });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/system/snapshot`);
    assert.equal(denied.status, 401);
    const ok = await fetch(`http://localhost:${port}/system/snapshot`, {
      headers: { authorization: 'Bearer secret-token' },
    });
    assert.equal(ok.status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('system-info source uses only safe docker commands (no socket/ps/inspect/run)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'system-info.ts'), 'utf8');
  for (const forbidden of [
    'docker ps',
    'docker inspect',
    'docker run',
    'docker stop',
    'docker start',
    'docker.sock',
    '/var/run/docker.sock',
  ]) {
    assert.ok(!src.includes(forbidden), `forbidden token present: ${forbidden}`);
  }
  // execFile (keine Shell) statt exec; und kein shell:true
  assert.ok(src.includes('execFile'), 'expected execFile usage');
  assert.ok(!src.includes('shell: true'), 'shell must not be enabled');
});
