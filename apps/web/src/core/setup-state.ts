/**
 * Reine Setup-Zustandslogik – importfrei und unit-testbar (ohne DB/Prisma).
 */
export type SetupState = 'needs-setup' | 'completed' | 'locked';
export type SystemMode = 'simple' | 'expert';

export const SETTING_SYSTEM_MODE = 'system.mode';
export const SETTING_SETUP_COMPLETED_AT = 'setup.completedAt';

/** Interpretiert den SETUP_LOCK-Env-Wert. */
export function isSetupLocked(envValue: string | undefined): boolean {
  if (!envValue) return false;
  const v = envValue.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * - Existiert ein User → Setup ist abgeschlossen.
 * - Kein User, aber SETUP_LOCK aktiv → gesperrt (kein Owner anlegbar).
 * - Sonst → Setup nötig.
 */
export function resolveSetupState(userCount: number, locked: boolean): SetupState {
  if (userCount > 0) return 'completed';
  if (locked) return 'locked';
  return 'needs-setup';
}

export function normalizeSystemMode(value: string): SystemMode {
  return value === 'expert' ? 'expert' : 'simple';
}
