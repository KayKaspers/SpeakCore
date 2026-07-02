/**
 * Read-only Managed-Server-Export (NDF Step 029). **Rein Web-/DB-seitig – kein Docker/Agent.**
 *
 * Liefert nicht-geheime Metadaten + optional die redigierte Audit-Historie als versioniertes JSON.
 * **Keine Secrets/Credentials/verschlüsselten Werte.** Es werden **keine** DB-Daten geschrieben – außer
 * dem Export-**Audit** (ohne Exportinhalt). OWNER-only erzwingt die Route.
 */
import { prisma } from './db';
import { logAudit } from './audit';
import {
  assertExportContainsNoSecrets,
  buildManagedServerExport,
  redactAuditEventForExport,
  type CredentialStatus,
  type ManagedServerExport,
} from './server-export-helpers';

export * from './server-export-helpers';

export type ServerExportStatus = 'ok' | 'notFound' | 'notManaged' | 'error';

export interface ServerExportResult {
  status: ServerExportStatus;
  export?: ManagedServerExport;
  filename?: string;
}

const MAX_AUDIT_EVENTS = 1000;

export async function exportManagedServer(
  serverId: string,
  actor: string,
  opts: { includeAudit?: boolean } = {},
): Promise<ServerExportResult> {
  // KEIN credential-Include – die verschlüsselten Werte werden nie geladen.
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server) return { status: 'notFound' };
  if (server.mode !== 'managed') return { status: 'notManaged' };

  // Credential-STATUS ohne Secret-Felder zu selektieren (nur Existenz).
  const cred = await prisma.serverCredential.findUnique({
    where: { serverInstanceId: serverId },
    select: { id: true },
  });
  const credentialStatus: CredentialStatus = server.credentialsRemovedAt
    ? 'removed'
    : cred
      ? 'kept'
      : 'none';

  const auditEvents = opts.includeAudit
    ? (
        await prisma.auditLog.findMany({
          where: { target: serverId },
          orderBy: { createdAt: 'asc' },
          take: MAX_AUDIT_EVENTS,
          select: { action: true, actor: true, target: true, result: true, createdAt: true },
        })
      ).map(redactAuditEventForExport)
    : [];

  await logAudit({ action: 'export.managedServer.requested', actor, target: serverId });

  let exportObj: ManagedServerExport;
  try {
    exportObj = buildManagedServerExport({ server, credentialStatus, auditEvents });
    assertExportContainsNoSecrets(exportObj); // Defense-in-Depth: niemals ein Leak ausliefern.
  } catch {
    await logAudit({ action: 'export.managedServer.failed', actor, target: serverId, result: 'failure' });
    return { status: 'error' };
  }

  await logAudit({ action: 'export.managedServer.completed', actor, target: serverId });

  const filename = `speakcore-server-${server.instanceId ?? server.id}-export.json`;
  return { status: 'ok', export: exportObj, filename };
}
