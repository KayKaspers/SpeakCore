import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EncryptionNotConfiguredError,
  InvalidEncryptionKeyError,
  decryptSecret,
  decryptWithKey,
  deriveKey,
  encryptSecret,
  encryptWithKey,
  isEncryptionConfigured,
  reencryptValue,
} from '../src/core/crypto';

const KEY = 'test-encryption-key-0123456789ab';
const OLD_KEY = 'old-encryption-key-0123456789abcd';
const NEW_KEY = 'new-encryption-key-0123456789abcd';

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

// --- NDF Step 016: explizite Schlüssel & Rotation ---

test('deriveKey rejects short keys', () => {
  assert.throws(() => deriveKey('short'), InvalidEncryptionKeyError);
  assert.equal(deriveKey(OLD_KEY).length, 32); // AES-256
});

test('encryptWithKey/decryptWithKey roundtrip with explicit key', () => {
  const key = deriveKey(OLD_KEY);
  const enc = encryptWithKey('serveradmin-secret', key);
  assert.match(enc, /^v1:/);
  assert.equal(decryptWithKey(enc, key), 'serveradmin-secret');
});

test('existing v1 value stays decryptable with its key (backward compat)', () => {
  // Ein mit dem alten Schlüssel erzeugter v1-Wert bleibt lesbar.
  const oldKey = deriveKey(OLD_KEY);
  const enc = encryptWithKey('legacy-value', oldKey);
  assert.equal(decryptWithKey(enc, oldKey), 'legacy-value');
});

test('reencryptValue re-encrypts old→new: ciphertext changes, plaintext preserved', () => {
  const oldKey = deriveKey(OLD_KEY);
  const newKey = deriveKey(NEW_KEY);
  const original = encryptWithKey('rotate-me', oldKey);
  const rotated = reencryptValue(original, oldKey, newKey);

  assert.notEqual(rotated, original); // verschlüsselter Wert ändert sich
  assert.equal(decryptWithKey(rotated, newKey), 'rotate-me'); // Klartext bleibt gleich
  assert.throws(() => decryptWithKey(rotated, oldKey)); // alter Schlüssel entschlüsselt nicht mehr
});

test('reencryptValue throws when old key does not match', () => {
  const oldKey = deriveKey(OLD_KEY);
  const newKey = deriveKey(NEW_KEY);
  const value = encryptWithKey('x', newKey); // bereits mit neuem Schlüssel verschlüsselt
  assert.throws(() => reencryptValue(value, oldKey, newKey));
});
