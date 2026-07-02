/**
 * Read-only Backup-Verify für einen managed Server auslösen (NDF Step 035).
 *
 * Delegiert an den read-only Agent-Endpunkt (SHA-256 neu berechnen + mit metadata.json vergleichen) –
 * **es wird nichts verändert**: kein Download, kein Restore, kein Delete, keine Metadata-Schreibaktion,
 * keine Docker-Aktion. Nur managed Server; **auch archivierte** dürfen verifizieren (Backups existieren
 * serverseitig weiter). **Keine DB-Schreiboperation außer dem Verify-Audit** (ohne Dateinamen/Werte).
 */
import { prisma } from './db';
import { logAudit } from './audit';
import { verifyManagedVolumeBackup } from '@/lib/agent-client';
import {
  buildBackupVerifyAuditEntries,
  isSafeBackupFileName,
  type BackupVerifyServiceResult,
} from './backup-verify-helpers';

export * from './backup-verify-helpers';

export async function verifyManagedVolumeBackupForServer(
  serverId: string,
  actor: string,
  fileName: string,
): Promise<BackupVerifyServiceResult> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server) return { status: 'notFound' };
  if (server.mode !== 'managed') return { status: 'notManaged', serverId };
  if (!server.instanceId) return { status: 'invalid', serverId };

  // Defense-in-Depth: grobe Web-Vorprüfung; der Agent validiert strikt gegen das Instanz-Muster.
  if (!isSafeBackupFileName(fileName)) {
    return { status: 'invalid', serverId };
  }

  const agent = await verifyManagedVolumeBackup({ instanceId: server.instanceId, fileName });

  if (!agent) {
    for (const e of buildBackupVerifyAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { status: 'unreachable', serverId };
  }

  const outcome =
    agent.status === 'valid' ? 'completed' : agent.status === 'mismatch' ? 'mismatch' : 'failed';
  for (const e of buildBackupVerifyAuditEntries(outcome, actor, serverId)) await logAudit(e);

  return {
    status: agent.status,
    serverId,
    fileName: agent.fileName,
    checksumSha256: agent.checksumSha256,
    metadataChecksumSha256: agent.metadataChecksumSha256,
    verifiedAt: agent.verifiedAt,
  };
}
