/*
 * Operator-CLI für die Rotation des Secret-Verschlüsselungsschlüssels (NDF Step 016).
 *
 * Bewusst KEINE Web-UI, KEINE Route, KEIN API-Endpunkt – nur ein lokal auszuführender Vorgang.
 *
 * Nutzung (im Verzeichnis apps/web, mit gesetztem DATABASE_URL):
 *   SECRET_ENCRYPTION_KEY=<alt> SECRET_ENCRYPTION_KEY_NEW=<neu> pnpm --filter @speakcore/web rotate-secrets --dry-run
 *   SECRET_ENCRYPTION_KEY=<alt> SECRET_ENCRYPTION_KEY_NEW=<neu> pnpm --filter @speakcore/web rotate-secrets
 *
 * Es werden ausschließlich Zählwerte ausgegeben – niemals Secrets oder Schlüssel.
 * Empfehlung: Vor der echten Rotation ein Backup der Datenbank anlegen.
 */
import {
  RotationConfigError,
  rotateServerCredentialEncryptionKeys,
} from '../src/core/secret-rotation';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  try {
    const result = await rotateServerCredentialEncryptionKeys({ dryRun });
    const mode = dryRun ? 'dry-run' : 'apply';
    // Nur Zählwerte – keine Secrets, keine Schlüssel.
    process.stdout.write(
      `secret-rotation (${mode}): total=${result.total} wouldRotate=${result.wouldRotate} ` +
        `rotated=${result.rotated} skipped=${result.skipped} failed=${result.failed} ` +
        `sameKey=${result.sameKey}\n`,
    );
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    if (error instanceof RotationConfigError) {
      process.stderr.write(`secret-rotation abgebrochen: ${error.reason}\n`);
      process.exit(2);
    }
    // Keine Fehlerdetails ausgeben, die Secrets/Schlüssel enthalten könnten.
    process.stderr.write('secret-rotation fehlgeschlagen (unerwarteter Fehler).\n');
    process.exit(3);
  }
}

void main();
