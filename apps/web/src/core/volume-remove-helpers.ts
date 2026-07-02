/**
 * Reine Helfer für das managed Volume-Remove (NDF Step 025) – unit-testbar, ohne DB/Agent.
 *
 * Die Bestätigungs-/Status-Vorprüfung nutzt die **Step-024-Guard-Logik** `canRemoveManagedVolume`
 * (Datenverlust- + Backup- + getippte Bestätigung). Die reale Existenzprüfung (Container/Volume/managed)
 * macht der Agent (Defense-in-Depth). Keine Docker-Ausführung, keine Secrets.
 */
import { canRemoveManagedVolume } from '@speakcore/shared';
import type { DeprovisionConfirmations } from '@speakcore/types';
import type { AuditInput } from './audit';

export type VolumeRemoveServiceStatus =
  | 'removed'
  | 'alreadyRemoved'
  | 'notFound'
  | 'invalidState'
  | 'invalidPlan'
  | 'dataLossRequired'
  | 'backupRequired'
  | 'typedMismatch'
  | 'containerStillExists'
  | 'conflict'
  | 'writeDisabled'
  | 'unavailable'
  | 'unreachable'
  | 'error';

export interface VolumeRemoveServiceResult {
  status: VolumeRemoveServiceStatus;
  serverId?: string;
  volumeName?: string;
}

/**
 * Web-seitige Vorprüfung von **Status + Bestätigungen** über den Step-024-Guard (optimistische
 * Existenzannahmen; der Agent re-verifiziert Container/Volume real). Liefert `ok` oder den fehlenden
 * Grund. Nur `RESOURCES_PREPARED` ist gültig.
 */
export function mapVolumeConfirmationGuard(
  provisioningStatus: string | null,
  confirmations: DeprovisionConfirmations,
): 'ok' | 'invalidState' | 'dataLossRequired' | 'backupRequired' | 'typedMismatch' {
  const guard = canRemoveManagedVolume(
    {
      instanceId: '',
      provisioningStatus,
      runState: null,
      container: { exists: false, running: false },
      volume: { exists: true, managed: true },
      network: { exists: true, managed: true, inUseByOthers: false },
    },
    confirmations,
  );
  if (guard.blockedReasons.includes('invalidState')) return 'invalidState';
  if (guard.requiredConfirmations.includes('confirmVolumeDataLoss')) return 'dataLossRequired';
  if (guard.requiredConfirmations.includes('confirmBackupRecommended')) return 'backupRequired';
  if (guard.blockedReasons.includes('typedConfirmationMismatch')) return 'typedMismatch';
  return 'ok';
}

/**
 * Persistierte Felder nach erfolgreichem Volume-Remove. **Enthält bewusst KEINE** `credential`/
 * `managedNetworkName`/`managedVolumeName`/`provisioningStatus` – diese bleiben unberührt. Nur der
 * Ist-Zustand `managedVolumeState='removed'` wird markiert.
 */
export function volumeRemoveSuccessUpdate(): {
  managedVolumeState: 'removed';
  lastProvisioningStep: 'volumeRemoved';
  lastProvisioningErrorKey: null;
} {
  return {
    managedVolumeState: 'removed',
    lastProvisioningStep: 'volumeRemoved',
    lastProvisioningErrorKey: null,
  };
}

export type VolumeRemoveAuditOutcome = 'removed' | 'alreadyRemoved' | 'conflict' | 'blocked' | 'failed';

export interface VolumeRemoveAuditParams {
  actor: string;
  serverId: string;
  /** true = Bestätigungen ok, Agent wurde aufgerufen. */
  confirmed: boolean;
  outcome: VolumeRemoveAuditOutcome;
}

/** Audit-Events (keine Secrets/Roh-Docker-Ausgabe, Target = ServerInstance-ID). */
export function buildVolumeRemoveAuditEntries(params: VolumeRemoveAuditParams): AuditInput[] {
  const t = params.serverId;
  const entries: AuditInput[] = [
    { action: 'deprovision.volumeRemove.requested', actor: params.actor, target: t },
  ];
  if (params.confirmed) {
    entries.push({ action: 'deprovision.volumeRemove.confirmed', actor: params.actor, target: t });
  }
  switch (params.outcome) {
    case 'removed':
      entries.push({ action: 'deprovision.volume.removed', actor: params.actor, target: t });
      entries.push({ action: 'deprovision.volumeRemove.completed', actor: params.actor, target: t });
      break;
    case 'alreadyRemoved':
      entries.push({ action: 'deprovision.volume.alreadyRemoved', actor: params.actor, target: t });
      entries.push({ action: 'deprovision.volumeRemove.completed', actor: params.actor, target: t });
      break;
    case 'conflict':
      entries.push({ action: 'deprovision.volumeRemove.conflict', actor: params.actor, target: t, result: 'failure' });
      entries.push({ action: 'deprovision.volumeRemove.failed', actor: params.actor, target: t, result: 'failure' });
      break;
    case 'blocked':
      entries.push({ action: 'deprovision.volumeRemove.blocked', actor: params.actor, target: t, result: 'failure' });
      break;
    default:
      entries.push({ action: 'deprovision.volumeRemove.failed', actor: params.actor, target: t, result: 'failure' });
  }
  return entries;
}

/** Generischer i18n-Fehlerschlüssel für den persistierten Provisioning-State (kein Secret/Detail). */
export function volumeRemoveErrorKey(status: VolumeRemoveServiceStatus): string | null {
  switch (status) {
    case 'containerStillExists':
      return 'containerStillExists';
    case 'conflict':
      return 'conflict';
    case 'unavailable':
      return 'unavailable';
    case 'unreachable':
      return 'unreachable';
    case 'error':
      return 'volumeRemoveFailed';
    default:
      return null;
  }
}
