/**
 * Managed Container starten (NDF Step 018): CONTAINER_CREATED → RUNNING.
 *
 * Nur nach **expliziter TS3-Lizenzzustimmung** des Nutzers. Delegiert an den Agent (`docker start`),
 * ohne Secrets/ENV zu übergeben und **ohne Docker-Logs zu lesen**. Kein `run`/`create`/`stop`/`rm`.
 * OWNER-only wird von der Server Action erzwungen.
 */
import { prisma } from './db';
import { logAudit } from './audit';
import { startManagedContainer } from '@/lib/agent-client';
import {
  buildContainerStartAuditEntries,
  containerStartErrorKey,
  resolveContainerStart,
  type ContainerStartServiceResult,
  type ContainerStartServiceStatus,
} from './container-start-helpers';

export * from './container-start-helpers';

export async function startManagedContainerForServer(
  serverId: string,
  actor: string,
  licenseAccepted: boolean,
): Promise<ContainerStartServiceResult> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server || server.mode !== 'managed') return { status: 'notFound' };

  if (resolveContainerStart(server.provisioningStatus) !== 'ok') {
    for (const e of buildContainerStartAuditEntries('failed', actor, serverId, false)) await logAudit(e);
    return { status: 'invalidState', serverId };
  }

  // Ohne explizite Lizenzzustimmung KEIN Start (Status unverändert, kein licenseConfirmed-Event).
  if (licenseAccepted !== true) {
    for (const e of buildContainerStartAuditEntries('failed', actor, serverId, false)) await logAudit(e);
    return { status: 'licenseRequired', serverId };
  }

  if (!server.instanceId) {
    for (const e of buildContainerStartAuditEntries('failed', actor, serverId, true)) await logAudit(e);
    return { status: 'invalidPlan', serverId };
  }

  const agent = await startManagedContainer({ instanceId: server.instanceId, licenseAccepted: true });

  if (!agent) {
    await prisma.serverInstance.update({
      where: { id: serverId },
      data: { lastProvisioningStep: 'START_CONTAINER', lastProvisioningErrorKey: 'unreachable' },
    });
    for (const e of buildContainerStartAuditEntries('failed', actor, serverId, true)) await logAudit(e);
    return { status: 'unreachable', serverId };
  }

  if (agent.status === 'started' || agent.status === 'running') {
    await prisma.serverInstance.update({
      where: { id: serverId },
      data: {
        provisioningStatus: 'RUNNING',
        runState: 'running',
        lastProvisioningStep: 'START_CONTAINER',
        lastProvisioningErrorKey: null,
      },
    });
    const kind = agent.status === 'started' ? 'started' : 'running';
    for (const e of buildContainerStartAuditEntries(kind, actor, serverId, true)) await logAudit(e);
    return { status: agent.status, serverId, containerName: agent.containerName };
  }

  // Fehlerfälle: Status bleibt CONTAINER_CREATED, generischer Fehlerschlüssel, kein Roh-Agent-Detail.
  const svcStatus: ContainerStartServiceStatus =
    agent.status === 'invalid' ? 'invalidPlan' : agent.status;
  await prisma.serverInstance.update({
    where: { id: serverId },
    data: {
      lastProvisioningStep: 'START_CONTAINER',
      lastProvisioningErrorKey: containerStartErrorKey(svcStatus),
    },
  });
  const kind = agent.status === 'conflict' ? 'conflict' : 'failed';
  for (const e of buildContainerStartAuditEntries(kind, actor, serverId, true)) await logAudit(e);
  return { status: svcStatus, serverId };
}
