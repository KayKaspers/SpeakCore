import 'server-only';
import { headers } from 'next/headers';

/**
 * Ermittelt die Client-IP aus Proxy-Headern.
 *
 * Hinweis: Diese Header sind nur vertrauenswürdig, wenn SpeakCore hinter einem korrekt
 * konfigurierten Reverse Proxy läuft (siehe docs/architecture/security.md). Ohne Header
 * (Direktverbindung) wird 'unknown' zurückgegeben – dann greift zusätzlich das
 * identifier-basierte Rate-Limiting.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return h.get('x-real-ip')?.trim() || 'unknown';
}
