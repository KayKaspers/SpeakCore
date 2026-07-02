/**
 * Reine Helfer für die managed Query-Adresse (NDF Step 020) – unit-testbar, ohne DB/Env-Zugriff.
 *
 * Die Query-Adresse ist die Adresse, unter der die Web-App den TS3-**ServerQuery-Port** eines managed
 * Servers **read-only** erreichen kann. Sie wird **explizit** gesetzt (UI-Eingabe hat Vorrang, sonst
 * Env-Default) – **nie geraten**, keine automatische IP-Ermittlung, keine Portscans.
 */

/** Name der Env-Variable, die einen Vorschlag für die managed Query-Adresse liefert (kein Zwang). */
export const MANAGED_QUERY_HOST_ENV = 'MANAGED_TS3_QUERY_HOST';

/**
 * Löst die zu speichernde Query-Adresse auf: **UI-Eingabe hat Vorrang**, sonst der Env-Default.
 * Beides leer ⇒ `null` (Healthcheck bleibt dann `notConfigured`). Es wird **nichts geraten**.
 * Validierung (Blocklist etc.) erfolgt separat über `validateServerHost`.
 */
export function resolveConfiguredQueryHost(
  submitted: string | undefined | null,
  envDefault: string | undefined | null,
): string | null {
  const s = (submitted ?? '').trim();
  if (s) return s;
  const e = (envDefault ?? '').trim();
  return e ? e : null;
}

/**
 * Entscheidet rein, ob der read-only TS3-Check versucht wird:
 * - Container läuft nicht ⇒ `unknown` (TS3 nicht geprüft)
 * - läuft, aber keine Query-Adresse ⇒ `notConfigured` (kein Raten/Portscan)
 * - läuft und Adresse vorhanden ⇒ `attempt`
 */
export function resolveTs3CheckMode(
  containerRunning: boolean,
  hasQueryAddress: boolean,
): 'unknown' | 'notConfigured' | 'attempt' {
  if (!containerRunning) return 'unknown';
  return hasQueryAddress ? 'attempt' : 'notConfigured';
}
