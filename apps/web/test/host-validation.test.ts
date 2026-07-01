import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePort, validateServerHost } from '../src/core/host-validation';

test('accepts hostnames and public/private IPs (self-hosting incl. LAN/localhost)', () => {
  for (const host of ['ts.example.com', 'server1', 'localhost', '192.168.1.10', '10.0.0.5', '203.0.113.9']) {
    assert.equal(validateServerHost(host).ok, true, host);
  }
});

test('blocks cloud-metadata / link-local / unspecified addresses', () => {
  for (const host of ['169.254.169.254', '169.254.1.1', '0.0.0.0', '::']) {
    const r = validateServerHost(host);
    assert.equal(r.ok, false, host);
    assert.equal(r.errorKey, 'hostBlocked', host);
  }
});

test('rejects malformed hosts', () => {
  assert.equal(validateServerHost('').errorKey, 'hostRequired');
  for (const host of ['http://ts.example.com', 'a b', 'user@host', 'ts/../x', '999.1.1.1']) {
    assert.equal(validateServerHost(host).ok, false, host);
  }
});

test('port range validation', () => {
  assert.equal(validatePort(10011), true);
  assert.equal(validatePort(1), true);
  assert.equal(validatePort(65535), true);
  assert.equal(validatePort(0), false);
  assert.equal(validatePort(70000), false);
  assert.equal(validatePort(10011.5), false);
});
