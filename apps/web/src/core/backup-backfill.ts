/**
 * Checksum-Backfill für einen managed Server auslösen (NDF Step 038).
 *
 * Delegiert an den token-gated Agent-Endpunkt: SHA-256 wird serverseitig berechnet und in die
 * `.metadata.json` nachgetragen – die **tar.gz bleibt unverändert**. Nur managed Server; **auch
 * archivierte** dürfen nachrüsten (Backups existieren serverseitig weiter). Kein Download, kein
 * Restore, kein Delete, keine Docker-Aktion. **Keine DB-Schreiboperation außer dem Audit.**
 */
import { prisma } from './db';
import { logAudit } from './audit';
import { backfillBackupChecksum } from '@/lib/agent-client';
import { isSafeBackupFileName } from './backup-verify-helpers';
import {
  buildChecksumBackfillAuditEntries,
  type BackupBackfillServiceResult,
} from './backup-backfill-helpers';

export * from './backup-backfill-helpers';

export async function backfillBackupChecksumForServer(
  serverId: string,
  actor: string,
  fileName: string,
): Promise<BackupBackfillServiceResult> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server) return { status: 'notFound' };
  if (server.mode !== 'managed') return { status: 'notManaged', serverId };
  if (!server.instanceId) return { status: 'invalid', serverId };

  // Defense-in-Depth: grobe Web-Vorprüfung; der Agent validiert strikt gegen das Instanz-Muster.
  if (!isSafeBackupFileName(fileName)) {
    return { status: 'invalid', serverId };
  }

  const agent = await backfillBackupChecksum({
    instanceId: server.instanceId,
    fileName,
    confirmChecksumBackfill: true,
  });

  if (!agent) {
    for (const e of buildChecksumBackfillAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { status: 'unreachable', serverId };
  }

  const outcome =
    agent.status === 'updated'
      ? 'completed'
      : agent.status === 'alreadyPresent'
        ? 'alreadyPresent'
        : 'failed';
  for (const e of buildChecksumBackfillAuditEntries(outcome, actor, serverId)) await logAudit(e);

  return { status: agent.status, serverId, fileName: agent.fileName };
}
