import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Secret-Verschlüsselung auf Anwendungsebene (NDF Step 008).
 *
 * AES-256-GCM (authentifiziert → Manipulation wird erkannt). Der Schlüssel wird deterministisch
 * aus einem Passphrase abgeleitet (SHA-256). Ohne gesetzten Schlüssel dürfen KEINE Secrets
 * gespeichert werden. Klartext-Secrets werden nie geloggt.
 *
 * Format: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`.
 *
 * Rotation (NDF Step 016): Das Format bleibt bei `v1` (Einzelschlüssel-Modell). Rotation bedeutet,
 * bestehende Werte mit dem alten Schlüssel zu entschlüsseln und mit dem neuen wieder zu verschlüsseln
 * (`reencryptValue`). Dadurch bleiben bestehende `v1`-Werte jederzeit entschlüsselbar; ein optionaler
 * Key-Identifier im Format ist bewusst aufgeschoben (siehe ADR-0022).
 */
const VERSION = 'v1';
const MIN_KEY_LENGTH = 16;

export class EncryptionNotConfiguredError extends Error {
  constructor() {
    super('SECRET_ENCRYPTION_KEY ist nicht gesetzt oder zu kurz.');
    this.name = 'EncryptionNotConfiguredError';
  }
}

export class InvalidEncryptionKeyError extends Error {
  constructor() {
    super('Verschlüsselungsschlüssel fehlt oder ist zu kurz.');
    this.name = 'InvalidEncryptionKeyError';
  }
}

export function isEncryptionConfigured(): boolean {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  return typeof raw === 'string' && raw.length >= MIN_KEY_LENGTH;
}

/**
 * Leitet aus einer Passphrase einen 32-Byte-Schlüssel (AES-256) ab. Die Passphrase selbst wird nie
 * gespeichert oder geloggt. Zu kurze Passphrasen werden abgewiesen.
 */
export function deriveKey(secret: string): Buffer {
  if (typeof secret !== 'string' || secret.length < MIN_KEY_LENGTH) {
    throw new InvalidEncryptionKeyError();
  }
  return createHash('sha256').update(secret, 'utf8').digest();
}

function envKey(): Buffer {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  if (!raw || raw.length < MIN_KEY_LENGTH) {
    throw new EncryptionNotConfiguredError();
  }
  return createHash('sha256').update(raw, 'utf8').digest();
}

/** Verschlüsselt Klartext mit einem expliziten (abgeleiteten) Schlüssel. */
export function encryptWithKey(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(
    ':',
  );
}

/** Entschlüsselt einen `v1`-Wert mit einem expliziten (abgeleiteten) Schlüssel. */
export function decryptWithKey(payload: string, key: Buffer): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Ungültiges Secret-Format.');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
  return plain.toString('utf8');
}

export function encryptSecret(plain: string): string {
  return encryptWithKey(plain, envKey());
}

export function decryptSecret(payload: string): string {
  return decryptWithKey(payload, envKey());
}

/**
 * Re-Encrypt eines bestehenden `v1`-Werts vom alten auf den neuen Schlüssel. Der Klartext wird
 * dabei nur intern gehalten, nie zurückgegeben oder geloggt. Wirft, wenn der Wert mit dem alten
 * Schlüssel nicht entschlüsselt werden kann (z. B. bereits rotiert oder beschädigt).
 */
export function reencryptValue(payload: string, oldKey: Buffer, newKey: Buffer): string {
  return encryptWithKey(decryptWithKey(payload, oldKey), newKey);
}
