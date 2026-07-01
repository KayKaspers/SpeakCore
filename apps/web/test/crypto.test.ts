import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EncryptionNotConfiguredError,
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
} from '../src/core/crypto';

const KEY = 'test-encryption-key-0123456789ab';

test('encrypt/decrypt roundtrip', () => {
  process.env.SECRET_ENCRYPTION_KEY = KEY;
  const enc = encryptSecret('serveradmin-token');
  assert.notEqual(enc, 'serveradmin-token');
  assert.match(enc, /^v1:/);
  assert.equal(decryptSecret(enc), 'serveradmin-token');
});

test('isEncryptionConfigured reflects env', () => {
  process.env.SECRET_ENCRYPTION_KEY = KEY;
  assert.equal(isEncryptionConfigured(), true);
  delete process.env.SECRET_ENCRYPTION_KEY;
  assert.equal(isEncryptionConfigured(), false);
});

test('missing key throws on encrypt', () => {
  delete process.env.SECRET_ENCRYPTION_KEY;
  assert.throws(() => encryptSecret('x'), EncryptionNotConfiguredError);
});

test('tampered ciphertext fails to decrypt (GCM integrity)', () => {
  process.env.SECRET_ENCRYPTION_KEY = KEY;
  const parts = encryptSecret('secret').split(':');
  const ct = Buffer.from(parts[3], 'base64');
  ct[0] ^= 0xff;
  parts[3] = ct.toString('base64');
  assert.throws(() => decryptSecret(parts.join(':')));
});

test('wrong format is rejected', () => {
  process.env.SECRET_ENCRYPTION_KEY = KEY;
  assert.throws(() => decryptSecret('not-a-valid-payload'));
});
