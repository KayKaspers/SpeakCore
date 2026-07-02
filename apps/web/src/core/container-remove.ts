/**
 * Managed Container entfernen (NDF Step 022): CONTAINER_CREATED → RESOURCES_PREPARED.
 *
 * Es wird **nur** `docker rm` (über den Agent) eines **gestoppten** Containers ausgeführt – **kein**
 * `-f`/`-v`, **keine** Volume-/Network-/Credential-/ServerInstance-Löschung, **kein** Log-Lesen. Läuft
 * der Container noch ⇒ `stillRunning` (zuerst stoppen). Fehlt er ⇒ idempotent `alreadyRemoved`.
 * OWNER-only wird von der Server Action erzwungen ([ADR-0026](../../project-brain/DECISIONS.md)).
 */
import { prisma } from './db';
import { logAudit } from './audit';
import { removeManagedContainer } from '@/lib/agent-client';
import {
  buildContainerRemoveAuditEntries,
  containerRemoveErrorKey,
  removeSuccessUpdate,
  resolveContainerRemove,
  type ContainerRemoveServiceResult,
  type ContainerRemoveServiceStatus,
} from './container-remove-helpers';

export * from './container-remove-helpers';

export async function removeManagedContainerForServer(
  serverId: string,
  actor: string,
): Promise<ContainerRemoveServiceResult> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server || server.mode !== 'managed') return { status: 'notFound' };

  const gate = resolveContainerRemove(server.provisioningStatus);
  if (gate === 'running') {
    // Läuft laut Lifecycle noch → kein Remove, Status unverändert, Hinweis „zuerst stoppen".
    await prisma.serverInstance.update({
      where: { id: serverId },
      data: { lastProvisioningStep: 'REMOVE_CONTAINER', lastProvisioningErrorKey: 'stillRunning' },
    });
    for (const e of buildContainerRemoveAuditEntries('stillRunning', actor, serverId)) await logAudit(e);
    return { status: 'stillRunning', serverId };
  }
  if (gate === 'invalidState') {
    for (const e of buildContainerRemoveAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { status: 'invalidState', serverId };
  }

  if (!server.instanceId) {
    for (const e of buildContainerRemoveAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { status: 'invalidPlan', serverId };
  }

  const agent = await removeManagedContainer({ instanceId: server.instanceId });

  if (!agent) {
    await prisma.serverInstance.update({
      where: { id: serverId },
      data: { lastProvisioningStep: 'REMOVE_CONTAINER', lastProvisioningErrorKey: 'unreachable' },
    });
    for (const e of buildContainerRemoveAuditEntries('failed', actor, serverId)) await logAudit(e);
    return { status: 'unreachable', serverId };
  }

  if (agent.status === 'removed' || agent.status === 'alreadyRemoved') {
    // Nur Lifecycle/runState zurücksetzen – Credentials und Volume/Network-Namen bleiben erhalten.
    await prisma.serverInstance.update({ where: { id: serverId }, data: removeSuccessUpdate() });
    const kind = agent.status === 'removed' ? 'removed' : 'alreadyRemoved';
    for (const e of buildContainerRemoveAuditEntries(kind, actor, serverId)) await logAudit(e);
    return { status: agent.status, serverId, containerName: agent.containerName };
  }

  if (agent.status === 'stillRunning') {
    await prisma.serverInstance.update({
      where: { id: serverId },
      data: { lastProvisioningStep: 'REMOVE_CONTAINER', lastProvisioningErrorKey: 'stillRunning' },
    });
    for (const e of buildContainerRemoveAuditEntries('stillRunning', actor, serverId)) await logAudit(e);
    return { status: 'stillRunning', serverId };
  }

  // Fehlerfälle: Status bleibt unverändert, generischer Fehlerschlüssel, kein Roh-Agent-Detail.
  const svcStatus: ContainerRemoveServiceStatus = agent.status === 'invalid' ? 'invalidPlan' : agent.status;
  await prisma.serverInstance.update({
    where: { id: serverId },
    data: {
      lastProvisioningStep: 'REMOVE_CONTAINER',
      lastProvisioningErrorKey: containerRemoveErrorKey(svcStatus),
    },
  });
  const kind = agent.status === 'conflict' ? 'conflict' : 'failed';
  for (const e of buildContainerRemoveAuditEntries(kind, actor, serverId)) await logAudit(e);
  return { status: svcStatus, serverId };
}
