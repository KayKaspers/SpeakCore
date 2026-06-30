import { defineRouting } from 'next-intl/routing';

/**
 * i18n-Routing (DE/EN ab 0.1, ADR-0007).
 * Standardsprache Deutsch; Englisch vollständig vorbereitet.
 */
export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
});

export type AppLocale = (typeof routing.locales)[number];
