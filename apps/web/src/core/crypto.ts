import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Secret-Verschlüsselung auf Anwendungsebene (NDF Step 008).
 *
 * AES-256-GCM (authentifiziert → Manipulation wird erkannt). Der Schlüssel wird deterministisch
 * aus `SECRET_ENCRYPTION_KEY` abgeleitet (SHA-256). Ohne gesetzten Schlüssel dürfen KEINE Secrets
 * gespeichert werden. Klartext-Secrets werden nie geloggt.
 *
 * Format: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`.
 */
const VERSION = 'v1';
const MIN_KEY_LENGTH = 16;

export class EncryptionNotConfiguredError extends Error {
  constructor() {
    super('SECRET_ENCRYPTION_KEY ist nicht gesetzt oder zu kurz.');
    this.name = 'EncryptionNotConfiguredError';
  }
}

export function isEncryptionConfigured(): boolean {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  return typeof raw === 'string' && raw.length >= MIN_KEY_LENGTH;
}

function getKey(): Buffer {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  if (!raw || raw.length < MIN_KEY_LENGTH) {
    throw new EncryptionNotConfiguredError();
  }
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(
    ':',
  );
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Ungültiges Secret-Format.');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}
