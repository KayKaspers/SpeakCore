import { prisma } from './db';
import { logAudit } from './audit';
import { deriveKey } from './crypto';
import {
  planCredentialRotation,
  resolveRotationKeys,
  type RotationOutcome,
} from './secret-rotation-helpers';

/**
 * Rotation des Secret-Verschlüsselungsschlüssels für `ServerCredential` (NDF Step 016).
 *
 * Grundlage für einen späteren Wechsel von `SECRET_ENCRYPTION_KEY`: bestehende (external wie managed)
 * Credentials werden mit dem ALTEN Schlüssel entschlüsselt und mit dem NEUEN Schlüssel wieder
 * verschlüsselt (Format bleibt `v1`, AES-256-GCM). Es gibt bewusst KEINE öffentliche UI, KEINE Route
 * und KEINEN API-Endpunkt – nur diesen serverseitigen Service (Operator-/CLI-Kontext).
 *
 * Sicherheitszusagen:
 *  - keine Secret-Ausgabe, keine Klartext-Werte im Rückgabewert
 *  - keine Schlüssel in Log/Audit/Fehlertext
 *  - Rückgabe ausschließlich Zählwerte
 *  - bei hartem Fehler wird NICHTS geschrieben (all-or-nothing via Transaktion)
 *
 * Die reine, testbare Logik liegt in `./secret-rotation-helpers`.
 */
export {
  RotationConfigError,
  type RotationAbortReason,
  type RotationCounts,
  type RotationOutcome,
} from './secret-rotation-helpers';

export interface RotateOptions {
  dryRun?: boolean;
  /** Alter Schlüssel; Standard: `SECRET_ENCRYPTION_KEY`. */
  oldKey?: string;
  /** Neuer Schlüssel; Standard: `SECRET_ENCRYPTION_KEY_NEW`. */
  newKey?: string;
}

/**
 * Rotiert die Verschlüsselung aller `ServerCredential`-Einträge. Idempotent: bereits mit dem neuen
 * Schlüssel verschlüsselte Werte werden als `skipped` erkannt (nicht erneut geschrieben).
 */
export async function rotateServerCredentialEncryptionKeys(
  options: RotateOptions = {},
): Promise<RotationOutcome> {
  const dryRun = options.dryRun ?? false;

  // Schlüssel prüfen, BEVOR die DB gelesen wird (wirft RotationConfigError bei fehlendem Schlüssel).
  const { oldRaw, newRaw, sameKey } = resolveRotationKeys(
    options.oldKey ?? process.env.SECRET_ENCRYPTION_KEY,
    options.newKey ?? process.env.SECRET_ENCRYPTION_KEY_NEW,
  );

  const credentials = await prisma.serverCredential.findMany({
    select: { id: true, encryptedUsername: true, encryptedPassword: true },
  });
  const total = credentials.length;

  // Identischer Schlüssel: kontrolliert überspringen, nichts schreiben.
  if (sameKey) {
    await logAudit({
      action: dryRun ? 'security.secretRotation.dryRun' : 'security.secretRotation.completed',
      actor: 'system',
    });
    return { total, wouldRotate: 0, rotated: 0, skipped: total, failed: 0, dryRun, sameKey: true };
  }

  const plan = planCredentialRotation(credentials, deriveKey(oldRaw), deriveKey(newRaw));

  if (dryRun) {
    await logAudit({ action: 'security.secretRotation.dryRun', actor: 'system' });
    return {
      total,
      wouldRotate: plan.wouldRotate,
      rotated: 0,
      skipped: plan.skipped,
      failed: plan.failed,
      dryRun: true,
      sameKey: false,
    };
  }

  // Harter Fehler (weder alt noch neu entschlüsselbar): nichts schreiben, sauber melden.
  if (plan.failed > 0) {
    await logAudit({ action: 'security.secretRotation.failed', actor: 'system', result: 'failure' });
    return {
      total,
      wouldRotate: plan.wouldRotate,
      rotated: 0,
      skipped: plan.skipped,
      failed: plan.failed,
      dryRun: false,
      sameKey: false,
    };
  }

  await logAudit({ action: 'security.secretRotation.started', actor: 'system' });

  // All-or-nothing: entweder alle rotierbaren Werte werden geschrieben oder keiner.
  await prisma.$transaction(
    plan.updates.map((u) =>
      prisma.serverCredential.update({
        where: { id: u.id },
        data: { encryptedUsername: u.encryptedUsername, encryptedPassword: u.encryptedPassword },
      }),
    ),
  );

  await logAudit({ action: 'security.secretRotation.completed', actor: 'system' });

  return {
    total,
    wouldRotate: plan.wouldRotate,
    rotated: plan.wouldRotate,
    skipped: plan.skipped,
    failed: 0,
    dryRun: false,
    sameKey: false,
  };
}
