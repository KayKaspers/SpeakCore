/**
 * Rate-Limiting – reine, importfreie Logik (unit-testbar ohne DB).
 * Sliding-Window-Zähler: zählt Treffer im Zeitfenster und entscheidet über Sperrung.
 */
export interface RateLimitConfig {
  /** Länge des Zeitfensters in Millisekunden. */
  windowMs: number;
  /** Maximal erlaubte Treffer im Fenster, bevor gesperrt wird. */
  max: number;
}

export interface RateLimitResult {
  limited: boolean;
  /** Verbleibende Versuche im aktuellen Fenster. */
  remaining: number;
  /** Wartezeit bis zum nächsten erlaubten Versuch (ms), 0 wenn nicht gesperrt. */
  retryAfterMs: number;
}

/** Bewertet eine Liste von Treffer-Zeitstempeln (ms) gegen die Konfiguration. */
export function evaluateRateLimit(
  hitTimes: number[],
  now: number,
  config: RateLimitConfig,
): RateLimitResult {
  const windowStart = now - config.windowMs;
  const inWindow = hitTimes.filter((t) => t > windowStart);
  const count = inWindow.length;
  const limited = count >= config.max;
  const remaining = Math.max(0, config.max - count);

  let retryAfterMs = 0;
  if (limited && inWindow.length > 0) {
    const oldest = Math.min(...inWindow);
    retryAfterMs = Math.max(0, oldest + config.windowMs - now);
  }

  return { limited, remaining, retryAfterMs };
}

// --- Konfiguration (Single-Node SQLite-MVP) -------------------------------

/** Login: max. 10 Fehlversuche je Schlüssel in 15 Minuten. */
export const LOGIN_RATE_LIMIT: RateLimitConfig = { windowMs: 15 * 60 * 1000, max: 10 };

/** Setup/Owner-Erstellung: max. 5 Versuche je IP in 15 Minuten. */
export const SETUP_RATE_LIMIT: RateLimitConfig = { windowMs: 15 * 60 * 1000, max: 5 };

/** Aufbewahrungsdauer für Rate-Limit-Einträge (Cleanup-Schwelle). */
export const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
