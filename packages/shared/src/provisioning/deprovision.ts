/**
 * Deprovisioning Safety Blueprint (NDF Step 024) – **reine Planungs-/Guard-Logik, KEINE Ausführung**.
 *
 * In diesem Step wird **nichts** gelöscht: keine echte Volume-/Network-Löschung, kein neues Docker-Write-
 * Kommando, kein DB-Schreiben, kein Löschen von ServerInstance/Credentials. Diese Funktionen bewerten nur,
 * **ob** eine spätere Deprovisioning-Aktion erlaubt wäre, **welche Bestätigungen** fehlen, **welches
 * Datenverlust-Risiko** besteht und **welche Audit-Events** dafür vorgesehen sind. `executable` ist immer
 * `false`. Fremde (nicht-managed) Ressourcen werden **nie** als löschbar geplant.
 *
 * Stufenmodell:
 *  - Stufe 1 Container entfernen (bereits live in Step 022) – kein Datenverlust.
 *  - Stufe 2 Volume entfernen – **Datenverlust!** nur ohne Container, `RESOURCES_PREPARED`, mit
 *    Datenverlust- + Backup-Bestätigung.
 *  - Stufe 3 Network entfernen – nur wenn kein managed Container mehr gebunden ist.
 *  - Stufe 4 ServerInstance archivieren – nur nach Container-Entfernung + getroffener Entscheidungen.
 */
import type {
  DeprovisionConfirmations,
  DeprovisionEvaluation,
  DeprovisionPlannedAction,
  DeprovisionRequest,
  DeprovisionResourceState,
  DeprovisionScope,
} from '@speakcore/types';
import { containerName, defaultVolumeName, networkName } from './constants';

/** Vorgesehene Audit-Events für spätere echte Deprovisioning-Steps (kein Secret, Target = ServerInstance). */
export const DEPROVISION_AUDIT = {
  planCreated: 'deprovision.plan.created',
  volumeRemoveRequested: 'deprovision.volumeRemove.requested',
  volumeRemoveBlocked: 'deprovision.volumeRemove.blocked',
  volumeRemoveConfirmed: 'deprovision.volumeRemove.confirmed',
  volumeRemoved: 'deprovision.volume.removed',
  networkRemoveRequested: 'deprovision.networkRemove.requested',
  networkRemoveBlocked: 'deprovision.networkRemove.blocked',
  networkRemoved: 'deprovision.network.removed',
  serverArchiveRequested: 'deprovision.serverArchive.requested',
  serverArchived: 'deprovision.server.archived',
} as const;

/** Getippte Bestätigung, die (falls angegeben) für die Volume-Löschung exakt passen muss. */
export const VOLUME_TYPED_CONFIRMATION = 'DELETE VOLUME';

export interface DeprovisionGuardResult {
  allowed: boolean;
  blockedReasons: string[];
  requiredConfirmations: string[];
}

/** Stufe 1 – Container entfernen (mirrort Step 022; kein Datenverlust). */
export function canRemoveManagedContainer(
  state: DeprovisionResourceState,
): DeprovisionGuardResult {
  const blockedReasons: string[] = [];
  if (state.container.exists && state.container.running) blockedReasons.push('containerRunning');
  if (
    state.provisioningStatus !== 'CONTAINER_CREATED' &&
    state.provisioningStatus !== 'RESOURCES_PREPARED'
  ) {
    blockedReasons.push('invalidState');
  }
  return { allowed: blockedReasons.length === 0, blockedReasons, requiredConfirmations: [] };
}

/** Stufe 2 – Volume entfernen (**Datenverlust**). Nur managed Volume, kein Container, mit Bestätigungen. */
export function canRemoveManagedVolume(
  state: DeprovisionResourceState,
  confirmations: DeprovisionConfirmations,
): DeprovisionGuardResult {
  const blockedReasons: string[] = [];
  const requiredConfirmations: string[] = [];

  if (!state.volume.exists) blockedReasons.push('volumeNotFound');
  else if (!state.volume.managed) blockedReasons.push('volumeNotManaged'); // fremde Ressource: nie löschbar
  if (state.container.exists) blockedReasons.push('containerStillExists');
  if (state.provisioningStatus !== 'RESOURCES_PREPARED') blockedReasons.push('invalidState');

  if (confirmations.confirmVolumeDataLoss !== true) requiredConfirmations.push('confirmVolumeDataLoss');
  if (confirmations.confirmBackupRecommended !== true) requiredConfirmations.push('confirmBackupRecommended');
  if (
    confirmations.typedConfirmation !== undefined &&
    confirmations.typedConfirmation !== VOLUME_TYPED_CONFIRMATION
  ) {
    blockedReasons.push('typedConfirmationMismatch');
  }

  return {
    allowed: blockedReasons.length === 0 && requiredConfirmations.length === 0,
    blockedReasons,
    requiredConfirmations,
  };
}

/** Stufe 3 – Network entfernen. Nur managed Network, kein gebundener managed Container. */
export function canRemoveManagedNetwork(
  state: DeprovisionResourceState,
  confirmations: DeprovisionConfirmations,
): DeprovisionGuardResult {
  const blockedReasons: string[] = [];
  const requiredConfirmations: string[] = [];

  if (!state.network.exists) blockedReasons.push('networkNotFound');
  else if (!state.network.managed) blockedReasons.push('networkNotManaged'); // fremde Ressource: nie löschbar
  if (state.container.exists) blockedReasons.push('containerStillExists');
  if (state.network.inUseByOthers) blockedReasons.push('networkInUse');

  if (confirmations.confirmNetworkUnused !== true) requiredConfirmations.push('confirmNetworkUnused');

  return {
    allowed: blockedReasons.length === 0 && requiredConfirmations.length === 0,
    blockedReasons,
    requiredConfirmations,
  };
}

/** Stufe 4 – ServerInstance archivieren/löschen. Nur nach Container-Entfernung + getroffener Entscheidungen. */
export function canArchiveManagedServer(
  state: DeprovisionResourceState,
  confirmations: DeprovisionConfirmations,
): DeprovisionGuardResult {
  const blockedReasons: string[] = [];
  const requiredConfirmations: string[] = [];

  if (state.container.exists) blockedReasons.push('containerStillExists');
  if (confirmations.confirmServerRecordArchive !== true) requiredConfirmations.push('confirmServerRecordArchive');
  // Credential-Entscheidung muss getroffen sein (true = löschen, false = behalten) – nicht undefined.
  if (confirmations.confirmCredentialRemoval === undefined) requiredConfirmations.push('confirmCredentialRemoval');

  return {
    allowed: blockedReasons.length === 0 && requiredConfirmations.length === 0,
    blockedReasons,
    requiredConfirmations,
  };
}

/**
 * Bewertet eine (spätere) Deprovisioning-Anfrage rein. `executable` ist immer `false`.
 * Fremde Ressourcen führen zu `decision: 'blocked'`, werden aber nie als ausführbare Aktion geplant.
 */
export function validateDeprovisioningRequest(request: DeprovisionRequest): DeprovisionEvaluation {
  const { scope, state, confirmations } = request;

  let guard: DeprovisionGuardResult;
  let plannedActions: DeprovisionPlannedAction[] = [];
  let warnings: string[] = [];
  let rollbackLimitations: string[] = [];
  let auditEvents: string[] = [DEPROVISION_AUDIT.planCreated];
  let dataLossRisk = false;
  let nextSafeState: string | null = null;

  switch (scope) {
    case 'containerOnly': {
      guard = canRemoveManagedContainer(state);
      plannedActions = [
        {
          action: 'REMOVE_MANAGED_CONTAINER',
          targetKind: 'container',
          managedName: containerName(state.instanceId),
          dataLoss: false,
        },
      ];
      nextSafeState = 'RESOURCES_PREPARED';
      break;
    }
    case 'volume': {
      guard = canRemoveManagedVolume(state, confirmations);
      dataLossRisk = true;
      warnings = ['volumeDataLossWarning'];
      rollbackLimitations = ['volumeRemovalIrreversible'];
      plannedActions = [
        {
          action: 'REMOVE_MANAGED_VOLUME',
          targetKind: 'volume',
          managedName: defaultVolumeName(state.instanceId),
          dataLoss: true,
        },
      ];
      auditEvents.push(
        ...(guard.allowed
          ? [
              DEPROVISION_AUDIT.volumeRemoveRequested,
              DEPROVISION_AUDIT.volumeRemoveConfirmed,
              DEPROVISION_AUDIT.volumeRemoved,
            ]
          : [DEPROVISION_AUDIT.volumeRemoveRequested, DEPROVISION_AUDIT.volumeRemoveBlocked]),
      );
      nextSafeState = 'RESOURCES_PREPARED';
      break;
    }
    case 'network': {
      guard = canRemoveManagedNetwork(state, confirmations);
      plannedActions = [
        {
          action: 'REMOVE_MANAGED_NETWORK',
          targetKind: 'network',
          managedName: networkName(),
          dataLoss: false,
        },
      ];
      auditEvents.push(
        ...(guard.allowed
          ? [DEPROVISION_AUDIT.networkRemoveRequested, DEPROVISION_AUDIT.networkRemoved]
          : [DEPROVISION_AUDIT.networkRemoveRequested, DEPROVISION_AUDIT.networkRemoveBlocked]),
      );
      nextSafeState = 'RESOURCES_PREPARED';
      break;
    }
    case 'serverRecord': {
      guard = canArchiveManagedServer(state, confirmations);
      plannedActions = [
        {
          action: 'ARCHIVE_SERVER_RECORD',
          targetKind: 'serverRecord',
          dataLoss: confirmations.confirmCredentialRemoval === true,
        },
      ];
      if (confirmations.confirmCredentialRemoval === true) {
        dataLossRisk = true;
        warnings.push('credentialRemovalWarning');
      }
      if (state.volume.exists || state.network.exists) warnings.push('archiveWithRemainingResources');
      auditEvents.push(
        ...(guard.allowed
          ? [DEPROVISION_AUDIT.serverArchiveRequested, DEPROVISION_AUDIT.serverArchived]
          : [DEPROVISION_AUDIT.serverArchiveRequested]),
      );
      nextSafeState = 'ARCHIVED';
      break;
    }
    case 'credentials': {
      // Credential-Löschung ist Teil der Archivierung; als eigenständiger Scope in 0.1 nicht geplant.
      guard = { allowed: false, blockedReasons: ['notPlannedInThisStep'], requiredConfirmations: ['confirmCredentialRemoval'] };
      dataLossRisk = true;
      warnings = ['credentialRemovalWarning'];
      break;
    }
    default: {
      guard = { allowed: false, blockedReasons: ['unknownScope'], requiredConfirmations: [] };
    }
  }

  return {
    scope,
    decision: guard.allowed ? 'allowed' : 'blocked',
    blockedReasons: guard.blockedReasons,
    requiredConfirmations: guard.requiredConfirmations,
    warnings,
    dataLossRisk,
    plannedActions,
    rollbackLimitations,
    auditEvents,
    nextSafeState,
    executable: false,
  };
}

/** Voller Überblicksplan über alle Stufen (rein, keine Ausführung). */
export function buildDeprovisioningPlan(
  state: DeprovisionResourceState,
  confirmations: DeprovisionConfirmations = {},
): DeprovisionEvaluation[] {
  const scopes: DeprovisionScope[] = ['containerOnly', 'volume', 'network', 'serverRecord'];
  return scopes.map((scope) => validateDeprovisioningRequest({ scope, state, confirmations }));
}
