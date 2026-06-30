/**
 * Passwort-Richtlinie – reine, importfreie Logik (unit-testbar ohne native Abhängigkeiten).
 * Server-seitig autoritativ; die Client-Validierung dient nur der UX.
 */

export const PASSWORD_MIN_LENGTH = 12;

/** Maschinenlesbare Regel-Schlüssel (für i18n-Fehlermeldungen). */
export type PasswordRule = 'minLength' | 'lowercase' | 'uppercase' | 'digit';

export interface PasswordCheckResult {
  valid: boolean;
  /** Verletzte Regeln (leer = gültig). */
  failed: PasswordRule[];
}

/** Prüft die Passwortstärke. Gibt verletzte Regeln zurück. */
export function checkPasswordStrength(password: string): PasswordCheckResult {
  const failed: PasswordRule[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) failed.push('minLength');
  if (!/[a-z]/.test(password)) failed.push('lowercase');
  if (!/[A-Z]/.test(password)) failed.push('uppercase');
  if (!/[0-9]/.test(password)) failed.push('digit');
  return { valid: failed.length === 0, failed };
}

/** Prüft Passwort + Bestätigung gemeinsam. */
export function checkPasswordPair(
  password: string,
  confirm: string,
): { valid: boolean; failed: PasswordRule[]; mismatch: boolean } {
  const strength = checkPasswordStrength(password);
  const mismatch = password !== confirm;
  return { valid: strength.valid && !mismatch, failed: strength.failed, mismatch };
}

/** Sehr einfache E-Mail-Plausibilitätsprüfung (keine vollständige RFC-Validierung). */
export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
