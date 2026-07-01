import { prisma } from './db';
import { EncryptionNotConfiguredError, decryptSecret, encryptSecret, isEncryptionConfigured } from './crypto';
import { logAudit } from './audit';
import { connectAndFetchStatus, createSocketTransport } from './ts3/client';
import type { Ts3ServerStatus } from './ts3/protocol';

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
): Promise<{ id: string }> {
  if (!isEncryptionConfigured()) {
    throw new EncryptionNotConfiguredError();
  }
  const encryptedUsername = encryptSecret(input.username);
  const encryptedPassword = encryptSecret(input.password);

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
        runState: 'connected',
        lastConnectedAt: new Date(),
      },
    });
    await tx.serverCredential.create({
      data: { serverInstanceId: server.id, encryptedUsername, encryptedPassword },
    });
    await logAudit({ action: 'server.connected', actor, target: server.id }, tx);
    return { id: server.id };
  });
}

/** Lädt einen Server, entschlüsselt die Credentials und ruft read-only den Status ab. */
export async function getServerStatus(id: string): Promise<Ts3ServerStatus> {
  const server = await prisma.serverInstance.findUnique({
    where: { id },
    include: { credential: true },
  });
  if (!server || !server.credential || !server.host || !server.queryPort) {
    return { reachable: false };
  }
  try {
    const username = decryptSecret(server.credential.encryptedUsername);
    const password = decryptSecret(server.credential.encryptedPassword);
    const transport = await createSocketTransport({
      host: server.host,
      queryPort: server.queryPort,
      timeoutMs: 5000,
    });
    return await connectAndFetchStatus(transport, { username, password }, server.virtualServerId ?? 1);
  } catch {
    // Keine Details/Secrets leaken.
    return { reachable: false };
  }
}
