/**
 * Managed Container stoppen (NDF Step 021): RUNNING → CONTAINER_CREATED (+ runState='stopped').
 *
 * Es wird **nur** `docker stop` (über den Agent) ausgeführt – **kein** `rm`/`restart`, **keine**
 * Löschung, **kein** Log-Lesen. Kein neuer Lifecycle-Status: der Container existiert weiter, ist nur
 * gestoppt (ADR-0025). OWNER-only wird von der Server Action erzwungen.
 */
import { prisma } from './db';
import { logAudit } from './audit';
import { stopManagedContainer } from '@/lib/agent-client';
import {
  buildContainerStopAuditEntries,
  containerStopErrorKey,
  resolveContainerStop,
  type ContainerStopServiceResult,
  type ContainerStopServiceStatus,
} from './container-stop-helpers';

export * from './container-stop-helpers';

export async function stopManagedContainerForServer(
  serverId: string,
  actor: string,
): Promise<ContainerStopServiceResult> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server || server.mode !== 'managed') return { status: 'notFound' };

  if (resolveContainerStop(server.provisioningStatus) !== 'ok') {
    for (const e of buildContainerStopAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { status: 'invalidState', serverId };
  }

  if (!server.instanceId) {
    for (const e of buildContainerStopAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { status: 'invalidPlan', serverId };
  }

  const agent = await stopManagedContainer({ instanceId: server.instanceId });

  if (!agent) {
    await prisma.serverInstance.update({
      where: { id: serverId },
      data: { lastProvisioningStep: 'STOP_CONTAINER', lastProvisioningErrorKey: 'unreachable' },
    });
    for (const e of buildContainerStopAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { status: 'unreachable', serverId };
  }

  if (agent.status === 'stopped' || agent.status === 'alreadyStopped') {
    await prisma.serverInstance.update({
      where: { id: serverId },
      data: {
        provisioningStatus: 'CONTAINER_CREATED',
        runState: 'stopped',
        lastProvisioningStep: 'STOP_CONTAINER',
        lastProvisioningErrorKey: null,
      },
    });
    const kind = agent.status === 'stopped' ? 'stopped' : 'alreadyStopped';
    for (const e of buildContainerStopAuditEntries(kind, actor, serverId)) await logAudit(e);
    return { status: agent.status, serverId, containerName: agent.containerName };
  }

  // Fehlerfälle: Status bleibt RUNNING, generischer Fehlerschlüssel, kein Roh-Agent-Detail.
  const svcStatus: ContainerStopServiceStatus = agent.status === 'invalid' ? 'invalidPlan' : agent.status;
  await prisma.serverInstance.update({
    where: { id: serverId },
    data: {
      lastProvisioningStep: 'STOP_CONTAINER',
      lastProvisioningErrorKey: containerStopErrorKey(svcStatus),
    },
  });
  const kind = agent.status === 'conflict' ? 'conflict' : 'failed';
  for (const e of buildContainerStopAuditEntries(kind, actor, serverId)) await logAudit(e);
  return { status: svcStatus, serverId };
}
