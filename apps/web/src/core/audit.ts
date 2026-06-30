import type { PrismaClient } from '@prisma/client';
import { prisma } from './db';

export interface AuditInput {
  action: string;
  actor: string;
  target?: string;
  result?: 'success' | 'failure';
}

/**
 * Schreibt einen Audit-Log-Eintrag. Akzeptiert optional einen Transaktions-Client,
 * damit der Eintrag atomar mit der auslösenden Aktion gespeichert werden kann.
 * Es werden bewusst KEINE sensiblen Daten (Passwörter, Tokens) protokolliert.
 */
export async function logAudit(
  input: AuditInput,
  client: Pick<PrismaClient, 'auditLog'> = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      action: input.action,
      actor: input.actor,
      target: input.target,
      result: input.result ?? 'success',
    },
  });
}
