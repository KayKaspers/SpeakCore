/**
 * Managed ServerRecord archivieren (NDF Step 027) – **abschließender Deprovisioning-Schritt**.
 *
 * **Rein Web-/DB-seitig: keine Docker-Aktion, kein Agent-Aufruf.** Archivieren **statt** hart löschen
 * (`archivedAt`/`archiveReasonKey` gesetzt, `ServerInstance` bleibt bestehen). Die Credential-Löschung
 * erfolgt **nur** bei ausdrücklicher Entscheidung (`credentialDecision='remove'`). **Audit-Historie bleibt
 * unangetastet.** OWNER-only + external-Ablehnung erzwingt/prüft die Server Action bzw. dieser Service.
 */
import { prisma } from './db';
import { logAudit } from './audit';
import {
  buildServerArchiveAuditEntries,
  mapArchiveGuard,
  type ServerArchiveConfirmations,
  type ServerArchiveServiceResult,
} from './server-archive-helpers';

export * from './server-archive-helpers';

export async function archiveManagedServer(
  serverId: string,
  actor: string,
  confirmations: ServerArchiveConfirmations,
): Promise<ServerArchiveServiceResult> {
  const server = await prisma.serverInstance.findUnique({
    where: { id: serverId },
    include: { credential: true },
  });
  if (!server) return { status: 'notFound' };
  // External Server (Step 008/009) NICHT über diesen Flow archivieren.
  if (server.mode !== 'managed') return { status: 'notManaged', serverId };
  if (server.archivedAt) return { status: 'alreadyArchived', serverId };

  const pre = mapArchiveGuard(server.provisioningStatus, confirmations);
  if (pre !== 'ok') {
    for (const e of buildServerArchiveAuditEntries({ actor, serverId, outcome: 'blocked' })) await logAudit(e);
    return { status: pre, serverId };
  }

  const decision = confirmations.credentialDecision === 'remove' ? 'remove' : 'keep';
  const now = new Date();
  const removeCredentials = decision === 'remove' && server.credential !== null;

  // Archivieren + (nur bei ausdrücklicher Entscheidung) Credential entfernen – atomar. KEIN Hard-Delete.
  await prisma.$transaction(async (tx) => {
    await tx.serverInstance.update({
      where: { id: serverId },
      data: {
        archivedAt: now,
        archiveReasonKey: 'deprovisioned',
        ...(removeCredentials ? { credentialsRemovedAt: now } : {}),
      },
    });
    if (removeCredentials) {
      await tx.serverCredential.deleteMany({ where: { serverInstanceId: serverId } });
    }
  });

  for (const e of buildServerArchiveAuditEntries({
    actor,
    serverId,
    outcome: 'archived',
    credentialDecision: decision,
  })) {
    await logAudit(e);
  }

  return { status: 'archived', serverId, credentialsRemoved: removeCredentials };
}
