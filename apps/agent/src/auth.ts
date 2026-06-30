import type { IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

/**
 * Platzhalter-Token-Authentifizierung (NDF Step 002).
 *
 * KONZEPT, noch NICHT in die Endpunkte eingebunden – /health und /version sind bewusst offen.
 * Zukünftige privilegierte Endpunkte werden den Bootstrap-Token prüfen (ADR-0005).
 * In Step 002 führt der Agent KEINE Host-/Docker-Aktionen aus.
 */
export function extractBearerToken(req: IncomingMessage): string | null {
  const header = req.headers['authorization'];
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

/** Konstantzeit-Vergleich, um Timing-Angriffe zu vermeiden. */
export function isValidToken(provided: string | null, expected: string | null): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
