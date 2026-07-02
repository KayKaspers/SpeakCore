/**
 * Managed Query-Adresse pflegen (NDF Step 020). OWNER-only wird von der Server Action erzwungen.
 *
 * Speichert die (validierte) Query-Adresse im vorhandenen `host`-Feld – **keine** Secrets, **keine**
 * Docker-Rohdaten, **keine** geratenen IPs. External Server bleiben unberührt.
 */
import { prisma } from './db';
import { logAudit } from './audit';

export * from './managed-query-helpers';

export type UpdateQueryAddressStatus = 'ok' | 'notFound' | 'notManaged';

/**
 * Setzt/aktualisiert die Query-Adresse eines managed Servers (`host`). `host = null` entfernt die
 * Adresse (Healthcheck wird dann `notConfigured`). Der Host muss bereits validiert sein.
 */
export async function updateManagedQueryAddress(
  serverId: string,
  host: string | null,
  actor: string,
): Promise<{ status: UpdateQueryAddressStatus }> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server) return { status: 'notFound' };
  if (server.mode !== 'managed') return { status: 'notManaged' };

  await prisma.serverInstance.update({ where: { id: serverId }, data: { host } });
  await logAudit({ action: 'managed.queryAddress.updated', actor, target: serverId });
  return { status: 'ok' };
}
