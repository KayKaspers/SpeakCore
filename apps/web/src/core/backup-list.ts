/**
 * Read-only Backup-Liste für einen managed Server abrufen (NDF Step 033).
 *
 * Delegiert an den read-only Agent-Endpunkt (nur `instanceId`, kein Pfad/Muster). **Nur Sichtbarkeit**:
 * kein Download, kein Restore, kein Delete, keine Docker-Aktion, kein Entpacken. Auch **archivierte**
 * managed Server dürfen ihre Backups sehen (bewusst – die Dateien existieren serverseitig weiter).
 * **Keine DB-Schreiboperation außer dem Listen-Audit** (ohne Dateiliste/Metadaten). Antworten werden
 * per Defense-in-Depth auf Secrets/Host-Pfade geprüft, bevor sie angezeigt werden.
 */
import { prisma } from './db';
import { logAudit } from './audit';
import { listManagedVolumeBackups } from '@/lib/agent-client';
import {
  assertBackupListContainsNoSecrets,
  buildBackupListAuditEntries,
  type BackupListServiceResult,
} from './backup-list-helpers';

export * from './backup-list-helpers';

export async function listManagedVolumeBackupsForServer(
  serverId: string,
  actor: string,
): Promise<BackupListServiceResult> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server) return { status: 'notFound' };
  if (server.mode !== 'managed') return { status: 'notManaged', serverId };

  // Ohne instanceId wurde nie provisioniert ⇒ es können keine Backups existieren (kein Agent-Call).
  if (!server.instanceId) {
    return { status: 'ok', serverId, backups: [] };
  }

  const agent = await listManagedVolumeBackups({ instanceId: server.instanceId });

  if (agent && agent.status === 'ok') {
    try {
      assertBackupListContainsNoSecrets(agent);
    } catch {
      // Verdächtige Antwort wird NICHT angezeigt (Defense-in-Depth).
      for (const e of buildBackupListAuditEntries('failed', actor, serverId)) await logAudit(e);
      return { status: 'error', serverId };
    }
    for (const e of buildBackupListAuditEntries('completed', actor, serverId)) await logAudit(e);
    return { status: 'ok', serverId, backups: agent.backups ?? [] };
  }

  for (const e of buildBackupListAuditEntries('failed', actor, serverId)) await logAudit(e);
  if (!agent) return { status: 'unreachable', serverId };
  if (agent.status === 'backupDirUnavailable') return { status: 'backupDirUnavailable', serverId };
  return { status: 'error', serverId };
}
