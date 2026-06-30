import { prisma } from './db';
import {
  RATE_LIMIT_RETENTION_MS,
  evaluateRateLimit,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limit-policy';

export * from './rate-limit-policy';

/**
 * DB-gestütztes Rate-Limiting (SQLite, Single-Node-MVP).
 * Persistent über Neustarts; kein externes Redis nötig. Distributed Rate-Limiting (mehrere
 * Instanzen) ist erst später relevant – siehe RISKS R-08 / DECISIONS ADR-0014.
 */

/** Prüft, ob der Schlüssel aktuell gesperrt ist (zählt Treffer im Fenster). */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const windowStart = new Date(now - config.windowMs);
  const hits = await prisma.rateLimitHit.findMany({
    where: { key, createdAt: { gt: windowStart } },
    select: { createdAt: true },
  });
  return evaluateRateLimit(
    hits.map((h) => h.createdAt.getTime()),
    now,
    config,
  );
}

/** Protokolliert einen Treffer (z. B. fehlgeschlagener Login / Setup-Versuch). */
export async function recordRateLimitHit(key: string): Promise<void> {
  await prisma.rateLimitHit.create({ data: { key } });
}

/** Setzt die Treffer für einen Schlüssel zurück (z. B. nach erfolgreichem Login). */
export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimitHit.deleteMany({ where: { key } });
}

/** Entfernt alte Einträge (Wartung). Kann periodisch aufgerufen werden. */
export async function cleanupRateLimits(now: number = Date.now()): Promise<void> {
  const threshold = new Date(now - RATE_LIMIT_RETENTION_MS);
  await prisma.rateLimitHit
    .deleteMany({ where: { createdAt: { lt: threshold } } })
    .catch(() => undefined);
}
