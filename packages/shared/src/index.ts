/**
 * @speakcore/shared – Geteilte Konstanten, App-Metadaten und Versionsinfo.
 *
 * NDF Step 002: bewusst minimal, keine fachliche Logik.
 */
import type { Locale, VersionInfo } from '@speakcore/types';

/** Anzeigename des Produkts. */
export const APP_NAME = 'SpeakCore Suite' as const;

/** Maschinenlesbarer Slug. */
export const APP_SLUG = 'speakcore' as const;

/** Produktversion (0.1-Linie). */
export const APP_VERSION = '0.1.0' as const;

/** Aktueller NDF-Schritt (Dokumentationszweck). */
export const NDF_STEP = 'Step 002' as const;

/** Unterstützte Sprachen. */
export const LOCALES: readonly Locale[] = ['de', 'en'] as const;

/** Standardsprache. */
export const DEFAULT_LOCALE: Locale = 'de';

/**
 * Schlüssel der Hauptnavigation (Platzhalter, NDF Step 002).
 * Die übersetzten Labels liegen in apps/web/messages/*.json unter "nav".
 */
export const NAV_KEYS = [
  'dashboard',
  'setup',
  'systemcheck',
  'servers',
  'backups',
  'help',
] as const;

export type NavKey = (typeof NAV_KEYS)[number];

/** Liefert die Versions-/Metadaten dieses Builds. */
export function getVersionInfo(commit?: string): VersionInfo {
  return {
    name: APP_NAME,
    version: APP_VERSION,
    ndfStep: NDF_STEP,
    ...(commit ? { commit } : {}),
  };
}
