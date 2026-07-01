import { randomBytes } from 'node:crypto';

/**
 * Erzeugt ein kryptographisch sicheres Secret (NDF Step 015).
 *
 * Bewusst **nur alphanumerisch** (A–Z, a–z, 0–9), um spätere Shell-/ENV-Probleme zu vermeiden.
 * Ausreichend lang (Default 32 Zeichen). Das Secret wird NIE geloggt/auditiert/im Client ausgegeben;
 * es wird ausschließlich verschlüsselt gespeichert (ADR-0018).
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateSecret(length = 32): string {
  if (length < 16) length = 16;
  // Rejection-Sampling für gleichverteilte Auswahl aus dem 62er-Alphabet.
  const max = 256 - (256 % ALPHABET.length);
  let out = '';
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < max) {
        out += ALPHABET[byte % ALPHABET.length];
        if (out.length === length) break;
      }
    }
  }
  return out;
}

/** Fester ServerQuery-Admin-Benutzername für managed TS3-Server (kein Nutzereinfluss). */
export const MANAGED_QUERY_USERNAME = 'serveradmin';
