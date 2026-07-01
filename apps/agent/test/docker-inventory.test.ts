import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import {
  parseContainers,
  parseNetworks,
  parseVolumes,
  toManagedLabelSet,
} from '../src/docker-inventory-parser';
import { gatherDockerInventory } from '../src/docker-inventory';
import { buildServer } from '../src/server';

const CONTAINERS = [
  'abc123|speakcore-ts3-clx1|running|speakcore.managed=true,speakcore.project=SpeakCore,speakcore.instanceId=clx1,speakcore.service=teamspeak3,com.docker.compose=foo',
  'def456|foreign-nginx|running|com.example=bar',
  'ghi789|speakcore-ts3-clx2|exited|speakcore.managed=true,speakcore.instanceId=clx2',
].join('\n');

test('parseContainers keeps managed, drops unmanaged, filters labels', () => {
  const containers = parseContainers(CONTAINERS);
  assert.equal(containers.length, 2); // foreign-nginx verworfen
  const first = containers[0];
  assert.equal(first.id, 'abc123');
  assert.equal(first.instanceId, 'clx1');
  assert.equal(first.service, 'teamspeak3');
  assert.equal(first.state, 'running');
  // Nur SpeakCore-Labels – keine fremden Labels durchgereicht.
  assert.deepEqual(Object.keys(first.labels).sort(), ['instanceId', 'managed', 'project', 'service']);
});

test('container DTO exposes no foreign/raw docker fields', () => {
  const allowed = new Set(['id', 'name', 'kind', 'managed', 'instanceId', 'service', 'state', 'labels']);
  for (const key of Object.keys(parseContainers(CONTAINERS)[0])) {
    assert.ok(allowed.has(key), `unexpected field leaked: ${key}`);
  }
});

test('toManagedLabelSet returns null for non-managed resources', () => {
  assert.equal(toManagedLabelSet({ 'com.example': 'x' }), null);
  assert.equal(toManagedLabelSet({ 'speakcore.managed': 'false' }), null);
  assert.ok(toManagedLabelSet({ 'speakcore.managed': 'true' }));
});

test('parseVolumes / parseNetworks keep only managed', () => {
  const volumes = parseVolumes(
    'speakcore-volume-ts3-clx1|speakcore.managed=true,speakcore.instanceId=clx1\nforeign-vol|other=1',
  );
  assert.equal(volumes.length, 1);
  assert.equal(volumes[0].name, 'speakcore-volume-ts3-clx1');

  const networks = parseNetworks(
    'net1|speakcore-network-voice|speakcore.managed=true,speakcore.service=voice-network\nnet2|bridge|',
  );
  assert.equal(networks.length, 1);
  assert.equal(networks[0].service, 'voice-network');
});

test('gatherDockerInventory never crashes and returns a valid status', async () => {
  const inv = await gatherDockerInventory();
  assert.ok(['available', 'unavailable'].includes(inv.status));
  assert.ok(Array.isArray(inv.containers));
  assert.ok(Array.isArray(inv.volumes));
  assert.ok(Array.isArray(inv.networks));
});

test('GET /docker/inventory is token-gated', async () => {
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token' });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    const denied = await fetch(`http://localhost:${port}/docker/inventory`);
    assert.equal(denied.status, 401);
    const ok = await fetch(`http://localhost:${port}/docker/inventory`, {
      headers: { authorization: 'Bearer secret-token' },
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { status: string };
    assert.ok(['available', 'unavailable'].includes(body.status));
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('docker-inventory sources contain no write/inspect/exec/socket commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src');
  const sources = ['docker-inventory.ts', 'docker-inventory-parser.ts'].map((f) =>
    readFileSync(join(srcDir, f), 'utf8'),
  );
  const forbidden = [
    'docker run',
    'docker start',
    'docker stop',
    'docker rm',
    'volume rm',
    'network rm',
    'docker inspect',
    'docker exec',
    'docker cp',
    'compose up',
    'compose down',
    'docker.sock',
    '/var/run/docker.sock',
  ];
  for (const src of sources) {
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token present: ${token}`);
    }
    assert.ok(!src.includes('shell: true'), 'shell must not be enabled');
  }
});
