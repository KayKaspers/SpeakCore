import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { buildSecurityHeaders } from './lib/security-headers';

const intlMiddleware = createMiddleware(routing);

/**
 * Wrappt die next-intl-Middleware und setzt zentrale Security-Header auf die Antwort
 * (inkl. Baseline-CSP). Siehe lib/security-headers.ts und SECURITY.md.
 */
export default function middleware(req: NextRequest) {
  const res = intlMiddleware(req);

  const isProd = process.env.NODE_ENV === 'production';
  const headers = buildSecurityHeaders({ isDev: !isProd, isProd });
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }

  return res;
}

export const config = {
  // Alle Pfade außer API, Next-Interna und Dateien mit Endung.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
