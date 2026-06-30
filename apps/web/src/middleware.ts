import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Alle Pfade außer API, Next-Interna und Dateien mit Endung.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
