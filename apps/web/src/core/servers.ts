import { prisma } from './db';
import { EncryptionNotConfiguredError, decryptSecret, encryptSecret, isEncryptionConfigured } from './crypto';
import { logAudit } from './audit';
import { connectAndFetchStatus, createSocketTransport } from './ts3/client';
import type { Ts3ServerStatus } from './ts3/protocol';
import { statusToServerUpdate } from './servers-status';

export { statusToServerUpdate };

export interface CreateExternalServerInput {
  name: string;
  host: string;
  queryPort: number;
  voicePort?: number;
  virtualServerId?: number;
  username: string;
  password: string;
}

export async function listServers() {
  return prisma.serverInstance.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getServer(id: string) {
  return prisma.serverInstance.findUnique({ where: { id } });
}

/** Testet eine TS3-Verbindung read-only (ohne zu speichern). Wirft bei Fehler (ohne Secret-Leak). */
export async function testTs3Connection(input: CreateExternalServerInput): Promise<Ts3ServerStatus> {
  const transport = await createSocketTransport({
    host: input.host,
    queryPort: input.queryPort,
    timeoutMs: 5000,
  });
  return connectAndFetchStatus(
    transport,
    { username: input.username, password: input.password },
    input.virtualServerId ?? 1,
  );
}

/** Legt einen externen TS3-Server + verschlüsselte Credentials an (atomar) und auditiert. */
export async function createExternalServer(
  input: CreateExternalServerInput,
  actor: string,
  status: Ts3ServerStatus,
): Promise<{ id: string }> {
  if (!isEncryptionConfigured()) {
    throw new EncryptionNotConfiguredError();
  }
  const encryptedUsername = encryptSecret(input.username);
  const encryptedPassword = encryptSecret(input.password);
  const snapshot = statusToServerUpdate(status);

  return prisma.$transaction(async (tx) => {
    const server = await tx.serverInstance.create({
      data: {
        name: input.name.trim(),
        type: 'teamspeak3',
        mode: 'external',
        host: input.host.trim(),
        queryPort: input.queryPort,
        voicePort: input.voicePort ?? null,
        virtualServerId: input.virtualServerId ?? null,
        ...snapshot,
      },
    });
    await tx.serverCredential.create({
      data: { serverInstanceId: server.id, encryptedUsername, encryptedPassword },
    });
    await logAudit({ action: 'server.connected', actor, target: server.id }, tx);
    return { id: server.id };
  });
}

/**
 * Aktualisiert den read-only Status eines Servers: verbindet, holt `serverinfo`, persistiert nur
 * Status-Metadaten und auditiert. Fehler werden generisch gespeichert (kein Secret-/Detail-Leak).
 */
export async function refreshServerStatus(id: string, actor: string): Promise<{ ok: boolean }> {
  const server = await prisma.serverInstance.findUnique({
    where: { id },
    include: { credential: true },
  });
  if (!server || !server.credential || !server.host || !server.queryPort) {
    return { ok: false };
  }

  let status: Ts3ServerStatus = { reachable: false };
  try {
    const username = decryptSecret(server.credential.encryptedUsername);
    const password = decryptSecret(server.credential.encryptedPassword);
    const transport = await createSocketTransport({
      host: server.host,
      queryPort: server.queryPort,
      timeoutMs: 5000,
    });
    status = await connectAndFetchStatus(transport, { username, password }, server.virtualServerId ?? 1);
  } catch {
    status = { reachable: false };
  }

  await prisma.serverInstance.update({ where: { id }, data: statusToServerUpdate(status) });
  await logAudit({
    action: 'server.status_refresh',
    actor,
    target: id,
    result: status.reachable ? 'success' : 'failure',
  });
  return { ok: status.reachable };
}

/**
 * Entfernt einen extern verbundenen Server. Die Credentials werden per DB-Cascade mitgelöscht.
 * Es wird KEINE Verbindung zum TS3-Server aufgebaut und nichts am TS3-Server verändert.
 */
export async function removeServer(id: string, actor: string): Promise<{ ok: boolean }> {
  const server = await prisma.serverInstance.findUnique({ where: { id } });
  if (!server) return { ok: false };
  await prisma.serverInstance.delete({ where: { id } });
  await logAudit({ action: 'server.removed', actor, target: id });
  return { ok: true };
}
