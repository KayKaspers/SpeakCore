/**
 * Managed Voice-Network entfernen (NDF Step 026). **Geteilte/globale** Ressource.
 *
 * Es wird **nur** das managed Network-Remove (über den Agent) ausgeführt – **kein** Force, **keine**
 * Volume-/Container-/Credential-/ServerInstance-Löschung, **kein** Log-Lesen. Voraussetzung: Bestätigung
 * `confirmNetworkUnused` (Step-024-Guard) und der Agent bestätigt real: **kein managed Container** mehr.
 * **Option A:** Kein ServerInstance-Statusfeld für das Network (globale Ressource) – nur Audit + UI-Hinweis;
 * der Ist-Zustand wird über Inventory/Agent geprüft. OWNER-only erzwingt die Server Action.
 */
import type { DeprovisionConfirmations } from '@speakcore/types';
import { prisma } from './db';
import { logAudit } from './audit';
import { removeManagedNetwork } from '@/lib/agent-client';
import {
  buildNetworkRemoveAuditEntries,
  mapNetworkConfirmationGuard,
  type NetworkRemoveServiceResult,
  type NetworkRemoveServiceStatus,
} from './network-remove-helpers';

export * from './network-remove-helpers';

export async function removeManagedNetworkForServer(
  serverId: string,
  actor: string,
  confirmations: DeprovisionConfirmations,
): Promise<NetworkRemoveServiceResult> {
  // Server nur laden, um Managed-Kontext + Audit-Target zu bestätigen (KEINE Statusänderung – Option A).
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server || server.mode !== 'managed') return { status: 'notFound' };

  if (mapNetworkConfirmationGuard(confirmations) !== 'ok') {
    for (const e of buildNetworkRemoveAuditEntries({ actor, serverId, confirmed: false, outcome: 'blocked' })) {
      await logAudit(e);
    }
    return { status: 'confirmationRequired', serverId };
  }

  const agent = await removeManagedNetwork();

  if (!agent) {
    for (const e of buildNetworkRemoveAuditEntries({ actor, serverId, confirmed: true, outcome: 'failed' })) {
      await logAudit(e);
    }
    return { status: 'unreachable', serverId };
  }

  const outcome =
    agent.status === 'removed'
      ? 'removed'
      : agent.status === 'alreadyRemoved'
        ? 'alreadyRemoved'
        : agent.status === 'inUseByManagedContainers'
          ? 'inUse'
          : agent.status === 'conflict'
            ? 'conflict'
            : 'failed';
  for (const e of buildNetworkRemoveAuditEntries({ actor, serverId, confirmed: true, outcome })) {
    await logAudit(e);
  }

  return { status: agent.status as NetworkRemoveServiceStatus, serverId, networkName: agent.networkName };
}
