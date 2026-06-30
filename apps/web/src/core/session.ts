import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from './db';

export const SESSION_COOKIE_NAME = 'speakcore_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 Tage

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET ist nicht gesetzt oder zu kurz (mind. 16 Zeichen).');
  }
  return secret;
}

/** Erzeugt einen kryptographisch zufälligen Roh-Token (nur im Cookie, nie in der DB). */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Bildet den in der DB gespeicherten HMAC-Hash des Tokens (Schlüssel = SESSION_SECRET). */
export function hashSessionToken(token: string): string {
  return createHmac('sha256', getSessionSecret()).update(token).digest('hex');
}

/** Legt eine Session an und liefert den Roh-Token + Ablaufzeitpunkt zurück. */
export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  // Gelegenheits-Cleanup: abgelaufene Sessions beim Login entfernen (geringe Frequenz).
  await cleanupExpiredSessions();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt },
  });
  return { token, expiresAt };
}

/** Entfernt abgelaufene Sessions (Wartung; kann auch periodisch laufen). */
export async function cleanupExpiredSessions(now: number = Date.now()): Promise<void> {
  await prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date(now) } } })
    .catch(() => undefined);
}

/** Validiert einen Roh-Token und liefert den zugehörigen Benutzer (oder null). */
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Konstantzeit-Vergleich der Hashes als zusätzliche Härtung.
  const a = Buffer.from(session.tokenHash);
  const b = Buffer.from(tokenHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}

/** Entwertet eine Session anhand ihres Roh-Tokens. */
export async function invalidateSession(token: string): Promise<void> {
  if (!token) return;
  await prisma.session
    .deleteMany({ where: { tokenHash: hashSessionToken(token) } })
    .catch(() => undefined);
}
