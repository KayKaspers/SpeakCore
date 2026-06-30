import { prisma } from './db';
import { hashPassword } from './password';
import { logAudit } from './audit';
import {
  SETTING_SETUP_COMPLETED_AT,
  SETTING_SYSTEM_MODE,
  normalizeSystemMode,
  type SystemMode,
} from './setup';

/** Wird geworfen, wenn bereits ein Account existiert (Owner darf nur einmal entstehen). */
export class OwnerAlreadyExistsError extends Error {
  constructor() {
    super('OWNER_ALREADY_EXISTS');
    this.name = 'OwnerAlreadyExistsError';
  }
}

export interface CreateOwnerInput {
  email: string;
  displayName?: string | null;
  password: string;
  mode: SystemMode;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}

export async function countUsers(): Promise<number> {
  return prisma.user.count();
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/**
 * Erstellt den OWNER-Account – nur erlaubt, wenn noch KEIN User existiert.
 * Persistiert Systemmodus + Setup-Abschluss und schreibt Audit-Einträge, alles atomar.
 */
export async function createOwner(input: CreateOwnerInput): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password);
  const mode = normalizeSystemMode(input.mode);
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.count();
    if (existing > 0) {
      throw new OwnerAlreadyExistsError();
    }

    const user = await tx.user.create({
      data: { email, displayName, passwordHash, role: 'OWNER' },
    });

    await tx.setting.upsert({
      where: { key: SETTING_SYSTEM_MODE },
      create: { key: SETTING_SYSTEM_MODE, value: mode },
      update: { value: mode },
    });
    await tx.setting.upsert({
      where: { key: SETTING_SETUP_COMPLETED_AT },
      create: { key: SETTING_SETUP_COMPLETED_AT, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    });

    await logAudit({ action: 'owner.created', actor: email, target: user.id }, tx);
    await logAudit({ action: 'setup.completed', actor: email, target: `mode:${mode}` }, tx);

    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
  });
}
