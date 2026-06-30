import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type os from 'node:os';
import { classifyCgroup, classifyVirtualization, detectEnvironment } from '../src/environment';
import { gatherNetwork, summarizeInterfaces } from '../src/network';
import { gatherSystemInfo } from '../src/system-info';

test('classifyVirtualization maps known values', () => {
  assert.equal(classifyVirtualization('none'), 'bare-metal');
  assert.equal(classifyVirtualization('kvm'), 'vm');
  assert.equal(classifyVirtualization('qemu'), 'vm');
  assert.equal(classifyVirtualization('vmware'), 'vm');
  assert.equal(classifyVirtualization('lxc'), 'container');
  assert.equal(classifyVirtualization('docker'), 'container');
  assert.equal(classifyVirtualization(''), 'unknown');
});

test('classifyCgroup detects container hints, else null', () => {
  assert.equal(classifyCgroup('0::/lxc/101/...'), 'container');
  assert.equal(classifyCgroup('12:pids:/docker/abc'), 'container');
  assert.equal(classifyCgroup('0::/init.scope'), null);
});

test('summarizeInterfaces: detects IPv4/IPv6 on non-internal interfaces only', () => {
  const ifaces = {
    lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    eth0: [
      { address: '192.168.1.5', family: 'IPv4', internal: false },
      { address: 'fe80::1', family: 'IPv6', internal: false },
    ],
  } as unknown as NodeJS.Dict<os.NetworkInterfaceInfo[]>;
  const s = summarizeInterfaces(ifaces);
  assert.equal(s.hasIpv4, true);
  assert.equal(s.hasIpv6, true);
  assert.equal(s.externalInterfaceCount, 1);
});

test('summarizeInterfaces: only loopback → no external interface', () => {
  const ifaces = {
    lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
  } as unknown as NodeJS.Dict<os.NetworkInterfaceInfo[]>;
  const s = summarizeInterfaces(ifaces);
  assert.equal(s.hasIpv4, false);
  assert.equal(s.externalInterfaceCount, 0);
});

test('gatherNetwork returns booleans/counts (no external request, no addresses)', () => {
  const net = gatherNetwork();
  assert.equal(typeof net.hasIpv4, 'boolean');
  assert.equal(typeof net.hasIpv6, 'boolean');
  assert.equal(typeof net.hasExternalInterface, 'boolean');
  assert.equal(typeof net.externalInterfaceCount, 'number');
  assert.ok(['present', 'unknown'].includes(net.dns.configured));
});

test('detectEnvironment returns a known kind without crashing', async () => {
  const env = await detectEnvironment();
  assert.ok(['proxmox-vm', 'proxmox-lxc', 'vm', 'container', 'bare-metal', 'unknown'].includes(env.kind));
  assert.equal(typeof env.confident, 'boolean');
});

test('gatherSystemInfo includes environment and network', async () => {
  const info = await gatherSystemInfo();
  assert.ok(info.environment);
  assert.ok(info.network);
  assert.equal(typeof info.network.hasIpv4, 'boolean');
});

test('probe sources make no external requests and no forbidden docker commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src');
  const sources = ['environment.ts', 'network.ts', 'system-info.ts'].map((f) =>
    readFileSync(join(srcDir, f), 'utf8'),
  );
  const forbidden = [
    'fetch(',
    'http.request',
    'https',
    'dns.lookup',
    'dns.resolve',
    'net.connect',
    'docker ps',
    'docker inspect',
    'docker run',
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
