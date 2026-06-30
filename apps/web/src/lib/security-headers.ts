/**
 * Zentrale Security-Header & Baseline-CSP – reine Funktionen (Edge-sicher, unit-testbar).
 * Keine externen Importe, damit sie auch in der Next.js-Middleware (Edge-Runtime) laufen.
 */

export interface SecurityHeaderOptions {
  /** Entwicklungsmodus: erlaubt HMR/Eval-Quellen, kein HSTS. */
  isDev: boolean;
  /** Produktionsmodus: aktiviert HSTS. */
  isProd: boolean;
}

/**
 * Baseline-CSP für den aktuellen Stand.
 *
 * Hinweis/Limitierung: `script-src`/`style-src` enthalten `'unsafe-inline'`, weil Next.js/React
 * Inline-Skripte (Hydration/Streaming) und Inline-Styles ausliefern und in Step 004 noch KEINE
 * Nonce-Architektur eingeführt wird (bewusst klein gehalten). Upgrade auf nonce-basierte CSP
 * ist als Härtungsschritt vorgemerkt (SECURITY.md, RISKS R-11).
 */
export function buildContentSecurityPolicy(isDev: boolean): string {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  const connectSrc = ["'self'"];
  if (isDev) {
    // React Fast Refresh / HMR
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push('ws:', 'wss:');
  }

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'img-src': ["'self'", 'data:'],
    'font-src': ["'self'", 'data:'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'script-src': scriptSrc,
    'connect-src': connectSrc,
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

/** Liefert die zu setzenden Security-Header als Schlüssel-Wert-Map. */
export function buildSecurityHeaders(options: SecurityHeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': buildContentSecurityPolicy(options.isDev),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  };

  // HSTS nur in Produktion (über HTTPS sinnvoll; über HTTP wird der Header ignoriert).
  if (options.isProd) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  return headers;
}
