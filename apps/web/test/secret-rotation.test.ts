import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decryptWithKey, deriveKey, encryptWithKey } from '../src/core/crypto';
import {
  RotationConfigError,
  planCredentialRotation,
  resolveRotationKeys,
} from '../src/core/secret-rotation-helpers';
import { rotateServerCredentialEncryptionKeys } from '../src/core/secret-rotation';

const OLD = 'old-encryption-key-0123456789abcd';
const NEW = 'new-encryption-key-0123456789abcd';
const oldKey = deriveKey(OLD);
const newKey = deriveKey(NEW);

// --- Schlüsselprüfung ---

test('resolveRotationKeys: missing old key aborts', () => {
  assert.throws(() => resolveRotationKeys(undefined, NEW), (e: unknown) => {
    return e instanceof RotationConfigError && e.reason === 'missingOldKey';
  });
});

test('resolveRotationKeys: missing new key aborts', () => {
  assert.throws(() => resolveRotationKeys(OLD, undefined), (e: unknown) => {
    return e instanceof RotationConfigError && e.reason === 'missingNewKey';
  });
});

test('resolveRotationKeys: too-short keys abort', () => {
  assert.throws(() => resolveRotationKeys('short', NEW), RotationConfigError);
  assert.throws(() => resolveRotationKeys(OLD, 'short'), RotationConfigError);
});

test('resolveRotationKeys: identical keys flagged sameKey', () => {
  assert.equal(resolveRotationKeys(OLD, OLD).sameKey, true);
  assert.equal(resolveRotationKeys(OLD, NEW).sameKey, false);
});

// --- Rotationsplanung (rein, ohne DB) ---

test('planCredentialRotation: external + managed both re-encrypted, plaintext preserved', () => {
  const rows = [
    // external: Query-Zugang eines bestehenden Servers
    {
      id: 'ext-1',
      encryptedUsername: encryptWithKey('external-user', oldKey),
      encryptedPassword: encryptWithKey('external-pass', oldKey),
    },
    // managed: SpeakCore-generiertes Query-Admin-Secret
    {
      id: 'man-1',
      encryptedUsername: encryptWithKey('serveradmin', oldKey),
      encryptedPassword: encryptWithKey('AbC123managedSecretValue00000000', oldKey),
    },
  ];

  const plan = planCredentialRotation(rows, oldKey, newKey);

  assert.equal(plan.wouldRotate, 2);
  assert.equal(plan.skipped, 0);
  assert.equal(plan.failed, 0);

  // Verschlüsselte Werte ändern sich ...
  assert.notEqual(plan.updates[0].encryptedUsername, rows[0].encryptedUsername);
  // ... Klartext bleibt identisch und ist mit dem neuen Schlüssel lesbar (external wie managed).
  assert.equal(decryptWithKey(plan.updates[0].encryptedUsername, newKey), 'external-user');
  assert.equal(decryptWithKey(plan.updates[0].encryptedPassword, newKey), 'external-pass');
  assert.equal(decryptWithKey(plan.updates[1].encryptedUsername, newKey), 'serveradmin');
  assert.equal(decryptWithKey(plan.updates[1].encryptedPassword, newKey), 'AbC123managedSecretValue00000000');
});

test('planCredentialRotation: already-rotated values are skipped (idempotent)', () => {
  const rows = [
    {
      id: 'done-1',
      encryptedUsername: encryptWithKey('user', newKey), // schon mit neuem Schlüssel
      encryptedPassword: encryptWithKey('pass', newKey),
    },
  ];
  const plan = planCredentialRotation(rows, oldKey, newKey);
  assert.deepEqual(
    { u: plan.updates.length, s: plan.skipped, f: plan.failed },
    { u: 0, s: 1, f: 0 },
  );
});

test('planCredentialRotation: corrupt value counts as failed, others unaffected', () => {
  const rows = [
    {
      id: 'ok-1',
      encryptedUsername: encryptWithKey('user', oldKey),
      encryptedPassword: encryptWithKey('pass', oldKey),
    },
    { id: 'bad-1', encryptedUsername: 'v1:broken:broken:broken', encryptedPassword: 'garbage' },
  ];
  const plan = planCredentialRotation(rows, oldKey, newKey);
  assert.equal(plan.wouldRotate, 1); // der gute Datensatz bleibt planbar
  assert.equal(plan.failed, 1); // der kaputte zerstört die anderen nicht
  assert.equal(plan.updates[0].id, 'ok-1');
});

test('planCredentialRotation: empty input yields zero counts', () => {
  const plan = planCredentialRotation([], oldKey, newKey);
  assert.deepEqual(plan, { updates: [], wouldRotate: 0, skipped: 0, failed: 0 });
});

// --- Service-Guards (ohne DB-Zugriff, da vor findMany abgebrochen) ---

test('service aborts on missing keys before touching the database', async () => {
  await assert.rejects(
    () => rotateServerCredentialEncryptionKeys({ oldKey: '', newKey: NEW }),
    RotationConfigError,
  );
  await assert.rejects(
    () => rotateServerCredentialEncryptionKeys({ oldKey: OLD, newKey: '' }),
    RotationConfigError,
  );
});

// --- Kein Secret im Ergebnis / keine öffentliche Angriffsfläche ---

test('rotation plan updates carry only v1 ciphertext, never plaintext', () => {
  const rows = [
    {
      id: 'x',
      encryptedUsername: encryptWithKey('super-secret-user', oldKey),
      encryptedPassword: encryptWithKey('super-secret-pass', oldKey),
    },
  ];
  const plan = planCredentialRotation(rows, oldKey, newKey);
  const serialized = JSON.stringify(plan);
  assert.ok(!serialized.includes('super-secret-user'));
  assert.ok(!serialized.includes('super-secret-pass'));
  assert.match(plan.updates[0].encryptedUsername, /^v1:/);
});

test('rotation sources contain no docker/agent/http and no server action or route', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const files = ['secret-rotation.ts', 'secret-rotation-helpers.ts'];
  const forbidden = [
    'docker ',
    'AGENT_URL',
    'execFile',
    'fetch(',
    "'use server'",
    'NextRequest',
    'NextResponse',
    'console.log',
  ];
  for (const f of files) {
    const src = readFileSync(join(coreDir, f), 'utf8');
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden token "${token}" in ${f}`);
    }
  }
});

test('no route/UI/API references the rotation service (operator-only)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const appDir = join(here, '..', 'src', 'app');

  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        if (readFileSync(full, 'utf8').includes('secret-rotation')) {
          offenders.push(full);
        }
      }
    }
  };
  walk(appDir);

  assert.deepEqual(offenders, [], `rotation must not be reachable from src/app: ${offenders.join(', ')}`);
});
