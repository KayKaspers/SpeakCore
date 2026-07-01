/**
 * Read-only Healthcheck für managed TS3-Server (NDF Step 019): CONTAINER-Laufzeit + optional TS3.
 *
 * Unterscheidet ehrlich zwischen **Lifecycle-Status** (`provisioningStatus`, bleibt unverändert) und
 * **Ist-Zustand** (Healthcheck-Felder). Es werden **keine** Logs gelesen, **kein** inspect/exec, **keine**
 * Reparatur ausgeführt. Roh-Docker-/TS3-Ausgaben und Secrets werden **nie** gespeichert/ausgegeben.
 */
import { prisma } from './db';
import { logAudit } from './audit';
import { decryptSecret, isEncryptionConfigured } from './crypto';
import { fetchManagedContainerStatus } from '@/lib/agent-client';
import { connectAndFetchStatus, createSocketTransport } from './ts3/client';
import type { Ts3ServerStatus } from './ts3/protocol';
import type { ContainerRuntimeStatus } from '@speakcore/types';
import {
  buildManagedHealthAuditEntries,
  healthErrorKey,
  isDefiniteRuntime,
  resolveHealthcheck,
  runStateForRuntime,
  type ManagedHealthResult,
  type Ts3ReachabilityStatus,
} from './managed-health-helpers';

export * from './managed-health-helpers';

/** Read-only TS3-ServerQuery-Basisstatus (nur wenn eine erreichbare Query-Adresse konfiguriert ist). */
async function checkTs3(server: {
  host: string | null;
  queryPort: number | null;
  virtualServerId: number | null;
  credential: { encryptedUsername: string; encryptedPassword: string } | null;
}): Promise<{ reach: Ts3ReachabilityStatus; status: Ts3ServerStatus | null }> {
  // Für managed Server ist die Query-Adresse aktuell nicht eindeutig erreichbar (kein host gesetzt):
  // nicht raten, keine Portscans → notConfigured. Sobald ein host/Query-Port vorliegt, wird read-only geprüft.
  if (!server.host || !server.queryPort || !server.credential || !isEncryptionConfigured()) {
    return { reach: 'notConfigured', status: null };
  }
  try {
    const username = decryptSecret(server.credential.encryptedUsername);
    const password = decryptSecret(server.credential.encryptedPassword);
    const transport = await createSocketTransport({
      host: server.host,
      queryPort: server.queryPort,
      timeoutMs: 5000,
    });
    const status = await connectAndFetchStatus(transport, { username, password }, server.virtualServerId ?? 1);
    return { reach: status.reachable ? 'reachable' : 'unreachable', status: status.reachable ? status : null };
  } catch {
    return { reach: 'unreachable', status: null };
  }
}

export async function runManagedHealthcheck(serverId: string, actor: string): Promise<ManagedHealthResult> {
  const server = await prisma.serverInstance.findUnique({
    where: { id: serverId },
    include: { credential: true },
  });
  if (!server) return { status: 'notFound' };
  if (server.mode !== 'managed') return { status: 'notManaged', serverId };
  if (resolveHealthcheck(server.provisioningStatus) !== 'ok') return { status: 'invalidState', serverId };

  // Container-Laufzeit read-only ermitteln. Agent nicht erreichbar / keine instanceId ⇒ unavailable.
  let runtime: ContainerRuntimeStatus = 'unavailable';
  if (server.instanceId) {
    const agent = await fetchManagedContainerStatus({ instanceId: server.instanceId });
    runtime = agent ? agent.status : 'unavailable';
  }
  const containerRunning = runtime === 'running';

  // Optionaler read-only TS3-Check nur, wenn der Container läuft.
  let ts3Reach: Ts3ReachabilityStatus = 'unknown';
  let ts3Status: Ts3ServerStatus | null = null;
  if (containerRunning) {
    const res = await checkTs3(server);
    ts3Reach = res.reach;
    ts3Status = res.status;
  }

  const now = new Date();
  const outcome = isDefiniteRuntime(runtime) ? 'completed' : 'failed';

  await prisma.serverInstance.update({
    where: { id: serverId },
    data: {
      lastHealthCheckedAt: now,
      containerRuntimeStatus: runtime,
      ts3ReachabilityStatus: ts3Reach,
      lastHealthErrorKey: healthErrorKey(runtime),
      runState: runStateForRuntime(runtime),
      ...(containerRunning ? { lastSuccessfulHealthCheckAt: now } : {}),
      ...(ts3Status?.reachable
        ? {
            statusName: ts3Status.name ?? null,
            statusVersion: ts3Status.version ?? null,
            statusPlatform: ts3Status.platform ?? null,
            statusClientsOnline: ts3Status.clientsOnline ?? null,
            statusMaxClients: ts3Status.maxClients ?? null,
            statusUptimeSeconds: ts3Status.uptimeSeconds ?? null,
          }
        : {}),
    },
  });

  const ts3AuditKind = ts3Reach === 'reachable' ? 'reachable' : ts3Reach === 'unreachable' ? 'unreachable' : null;
  for (const e of buildManagedHealthAuditEntries({
    actor,
    serverId,
    containerRunning,
    ts3: ts3AuditKind,
    outcome,
  })) {
    await logAudit(e);
  }

  return { status: 'ok', serverId, containerRuntimeStatus: runtime, ts3ReachabilityStatus: ts3Reach };
}
