import { hash, verify, type Algorithm } from '@node-rs/argon2';

/**
 * Passwort-Hashing mit Argon2id (ADR-0006).
 * Parameter konservativ gewählt (OWASP-nahe Defaults für Argon2id).
 *
 * Hinweis: `Algorithm` ist im Paket ein `const enum`; unter `isolatedModules` darf es nicht
 * als Wert importiert werden. Daher der numerische Literal-Wert (2 = Argon2id) als Typ-Cast.
 */
const ARGON2ID = 2 as Algorithm; // Algorithm.Argon2id
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hashString: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashString, plain, ARGON2_OPTIONS);
  } catch {
    // Defekter/ungültiger Hash → niemals als gültig behandeln, keine Details leaken.
    return false;
  }
}

export * from './password-policy';
