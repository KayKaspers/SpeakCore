import { decryptWithKey, reencryptValue } from './crypto';

/**
 * Reine (DB-freie) Logik für die Secret-Schlüssel-Rotation (NDF Step 016).
 *
 * Hier liegen ausschließlich testbare, seiteneffektfreie Bausteine: Schlüsselprüfung und die
 * Planung, welche `ServerCredential`-Werte neu verschlüsselt werden. Kein Prisma, kein `server-only`,
 * keine Secret-Ausgabe. Der eigentliche DB-Zugriff/Transaktion liegt in `secret-rotation.ts`.
 */

export const MIN_KEY_LENGTH = 16;

export interface RotationCounts {
  total: number;
  wouldRotate: number;
  rotated: number;
  skipped: number;
  failed: number;
}

export interface RotationOutcome extends RotationCounts {
  dryRun: boolean;
  /** true, wenn alter und neuer Schlüssel identisch sind (kontrolliert übersprungen). */
  sameKey: boolean;
}

export type RotationAbortReason = 'missingOldKey' | 'missingNewKey';

export class RotationConfigError extends Error {
  constructor(public readonly reason: RotationAbortReason) {
    super(`Secret-Rotation abgebrochen: ${reason}`);
    this.name = 'RotationConfigError';
  }
}

export function isUsableKey(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.length >= MIN_KEY_LENGTH;
}

export interface ResolvedRotationKeys {
  oldRaw: string;
  newRaw: string;
  sameKey: boolean;
}

/**
 * Prüft alten/neuen Schlüssel. Wirft `RotationConfigError`, wenn einer fehlt oder zu kurz ist.
 * Gibt keine Schlüssel-Ableitungen zurück, nur die validierten Rohwerte + `sameKey`-Flag.
 */
export function resolveRotationKeys(
  oldRaw: string | undefined | null,
  newRaw: string | undefined | null,
): ResolvedRotationKeys {
  if (!isUsableKey(oldRaw)) {
    throw new RotationConfigError('missingOldKey');
  }
  if (!isUsableKey(newRaw)) {
    throw new RotationConfigError('missingNewKey');
  }
  return { oldRaw, newRaw, sameKey: oldRaw === newRaw };
}

export interface EncryptedCredentialRow {
  id: string;
  encryptedUsername: string;
  encryptedPassword: string;
}

export interface CredentialUpdate {
  id: string;
  encryptedUsername: string;
  encryptedPassword: string;
}

export interface RotationPlan {
  updates: CredentialUpdate[];
  wouldRotate: number;
  skipped: number;
  failed: number;
}

/**
 * Bestimmt für eine Liste verschlüsselter Credentials, welche neu verschlüsselt werden müssen.
 *
 * - Entschlüsselbar mit altem Schlüssel → Re-Encrypt geplant (`updates`).
 * - Entschlüsselbar nur mit neuem Schlüssel → bereits rotiert, `skipped` (idempotent).
 * - Weder noch → `failed` (beschädigt/fremder Schlüssel).
 *
 * Reine Funktion: keine DB, keine Ausgabe von Klartext. Beide Felder eines Credentials werden nur
 * gemeinsam als Update aufgenommen (kein Teil-Update eines Datensatzes).
 */
export function planCredentialRotation(
  rows: EncryptedCredentialRow[],
  oldKey: Buffer,
  newKey: Buffer,
): RotationPlan {
  const updates: CredentialUpdate[] = [];
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const encryptedUsername = reencryptValue(row.encryptedUsername, oldKey, newKey);
      const encryptedPassword = reencryptValue(row.encryptedPassword, oldKey, newKey);
      updates.push({ id: row.id, encryptedUsername, encryptedPassword });
    } catch {
      // Mit altem Schlüssel nicht lesbar → prüfen, ob bereits mit neuem Schlüssel verschlüsselt.
      try {
        decryptWithKey(row.encryptedUsername, newKey);
        decryptWithKey(row.encryptedPassword, newKey);
        skipped += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return { updates, wouldRotate: updates.length, skipped, failed };
}
