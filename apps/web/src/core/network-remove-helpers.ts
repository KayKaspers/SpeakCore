/**
 * Reine Helfer für das managed Network-Remove (NDF Step 026) – unit-testbar, ohne DB/Agent.
 *
 * Das Voice-Network ist **geteilt/global**. Die Bestätigungs-Vorprüfung nutzt die Step-024-Guard-Logik
 * `canRemoveManagedNetwork` (`confirmNetworkUnused`). Die reale „kein managed Container mehr"-Prüfung
 * macht der Agent (Defense-in-Depth). Keine Docker-Ausführung, keine Secrets. **Option A:** kein
 * ServerInstance-Statusfeld für das Network (globale Ressource; Ist-Zustand via Inventory/Agent + Audit).
 */
import { canRemoveManagedNetwork } from '@speakcore/shared';
import type { DeprovisionConfirmations } from '@speakcore/types';
import type { AuditInput } from './audit';

export type NetworkRemoveServiceStatus =
  | 'removed'
  | 'alreadyRemoved'
  | 'notFound'
  | 'confirmationRequired'
  | 'inUseByManagedContainers'
  | 'conflict'
  | 'writeDisabled'
  | 'unavailable'
  | 'unreachable'
  | 'error';

export interface NetworkRemoveServiceResult {
  status: NetworkRemoveServiceStatus;
  serverId?: string;
  networkName?: string;
}

/**
 * Web-seitige Vorprüfung der Bestätigung über den Step-024-Guard (optimistische Existenzannahmen; der
 * Agent re-verifiziert real „kein managed Container"). `ok` oder `confirmationRequired`.
 */
export function mapNetworkConfirmationGuard(
  confirmations: DeprovisionConfirmations,
): 'ok' | 'confirmationRequired' {
  const guard = canRemoveManagedNetwork(
    {
      instanceId: '',
      provisioningStatus: 'RESOURCES_PREPARED',
      runState: null,
      container: { exists: false, running: false },
      volume: { exists: true, managed: true },
      network: { exists: true, managed: true, inUseByOthers: false },
    },
    confirmations,
  );
  return guard.requiredConfirmations.includes('confirmNetworkUnused') ? 'confirmationRequired' : 'ok';
}

export type NetworkRemoveAuditOutcome =
  | 'removed'
  | 'alreadyRemoved'
  | 'inUse'
  | 'conflict'
  | 'blocked'
  | 'failed';

export interface NetworkRemoveAuditParams {
  actor: string;
  /** Auslösender managed Server (Audit-Target); das Network selbst ist global. */
  serverId: string;
  confirmed: boolean;
  outcome: NetworkRemoveAuditOutcome;
}

/** Audit-Events (keine Secrets/Roh-Docker-Ausgabe, Target = auslösende ServerInstance-ID). */
export function buildNetworkRemoveAuditEntries(params: NetworkRemoveAuditParams): AuditInput[] {
  const t = params.serverId;
  const entries: AuditInput[] = [
    { action: 'deprovision.networkRemove.requested', actor: params.actor, target: t },
  ];
  if (params.confirmed) {
    entries.push({ action: 'deprovision.networkRemove.confirmed', actor: params.actor, target: t });
  }
  switch (params.outcome) {
    case 'removed':
      entries.push({ action: 'deprovision.network.removed', actor: params.actor, target: t });
      entries.push({ action: 'deprovision.networkRemove.completed', actor: params.actor, target: t });
      break;
    case 'alreadyRemoved':
      entries.push({ action: 'deprovision.network.alreadyRemoved', actor: params.actor, target: t });
      entries.push({ action: 'deprovision.networkRemove.completed', actor: params.actor, target: t });
      break;
    case 'inUse':
      entries.push({ action: 'deprovision.networkRemove.inUse', actor: params.actor, target: t, result: 'failure' });
      entries.push({ action: 'deprovision.networkRemove.failed', actor: params.actor, target: t, result: 'failure' });
      break;
    case 'conflict':
      entries.push({ action: 'deprovision.networkRemove.conflict', actor: params.actor, target: t, result: 'failure' });
      entries.push({ action: 'deprovision.networkRemove.failed', actor: params.actor, target: t, result: 'failure' });
      break;
    case 'blocked':
      entries.push({ action: 'deprovision.networkRemove.blocked', actor: params.actor, target: t, result: 'failure' });
      break;
    default:
      entries.push({ action: 'deprovision.networkRemove.failed', actor: params.actor, target: t, result: 'failure' });
  }
  return entries;
}
