import { prisma } from './db';
import { isSetupLocked, resolveSetupState, type SetupState } from './setup-state';

// Reine Logik & Konstanten werden hier wieder exportiert (eine Importquelle für Aufrufer).
export * from './setup-state';

/** Liefert den aktuellen Setup-Zustand aus DB + Environment. */
export async function getSetupState(): Promise<SetupState> {
  const userCount = await prisma.user.count();
  return resolveSetupState(userCount, isSetupLocked(process.env.SETUP_LOCK));
}
