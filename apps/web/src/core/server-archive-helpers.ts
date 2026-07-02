/**
 * Reine Helfer für das Archivieren managed ServerRecords (NDF Step 027) – unit-testbar, ohne DB.
 *
 * **Rein Web-/DB-seitig** – **keine** Docker-/Agent-Aktion. Archivieren statt hart löschen. Die
 * Bestätigungs-/Status-Vorprüfung nutzt die **Step-024-Guard-Logik** `canArchiveManagedServer`.
 * Credentials werden **nur** bei ausdrücklicher Entscheidung entfernt. Keine Secrets.
 */
import { canArchiveManagedServer } from '@speakcore/shared';
import type { AuditInput } from './audit';

/** Getippte Bestätigung für den finalen Deprovisioning-Schritt. */
export const ARCHIVE_TYPED_CONFIRMATION = 'ARCHIVE SERVER';

export type CredentialDecision = 'keep' | 'remove';

export interface ServerArchiveConfirmations {
  confirmServerRecordArchive: boolean;
  /** Bewusste Entscheidung; `undefined` = keine getroffen (blockiert). */
  credentialDecision?: CredentialDecision;
  typedConfirmation: string;
}

export type ServerArchiveServiceStatus =
  | 'archived'
  | 'alreadyArchived'
  | 'notFound'
  | 'notManaged'
  | 'invalidState'
  | 'archiveConfirmRequired'
  | 'credentialDecisionRequired'
  | 'typedMismatch';

export interface ServerArchiveServiceResult {
  status: ServerArchiveServiceStatus;
  serverId?: string;
  credentialsRemoved?: boolean;
}

/**
 * Vorprüfung von Status + Bestätigungen über den Step-024-Guard. Nur `RESOURCES_PREPARED` (Container gilt
 * als entfernt) ist gültig; RUNNING/CONTAINER_CREATED/CONTAINER_PENDING/DRAFT werden abgelehnt.
 */
export function mapArchiveGuard(
  provisioningStatus: string | null,
  confirmations: ServerArchiveConfirmations,
):
  | 'ok'
  | 'invalidState'
  | 'archiveConfirmRequired'
  | 'credentialDecisionRequired'
  | 'typedMismatch' {
  if (provisioningStatus !== 'RESOURCES_PREPARED') return 'invalidState';

  const confirmCredentialRemoval =
    confirmations.credentialDecision === 'remove'
      ? true
      : confirmations.credentialDecision === 'keep'
        ? false
        : undefined;

  const guard = canArchiveManagedServer(
    {
      instanceId: '',
      provisioningStatus,
      runState: null,
      container: { exists: false, running: false },
      volume: { exists: false, managed: true },
      network: { exists: false, managed: true, inUseByOthers: false },
    },
    { confirmServerRecordArchive: confirmations.confirmServerRecordArchive, confirmCredentialRemoval },
  );

  if (guard.requiredConfirmations.includes('confirmServerRecordArchive')) return 'archiveConfirmRequired';
  if (guard.requiredConfirmations.includes('confirmCredentialRemoval')) return 'credentialDecisionRequired';
  if (confirmations.typedConfirmation !== ARCHIVE_TYPED_CONFIRMATION) return 'typedMismatch';
  return 'ok';
}

export type ServerArchiveAuditOutcome = 'archived' | 'blocked';

export interface ServerArchiveAuditParams {
  actor: string;
  serverId: string;
  outcome: ServerArchiveAuditOutcome;
  /** Nur relevant bei `archived`: getroffene Credential-Entscheidung. */
  credentialDecision?: CredentialDecision;
}

/** Audit-Events (keine Secrets, Target = ServerInstance-ID). Bei Erfolg mit Credential-Entscheidung. */
export function buildServerArchiveAuditEntries(params: ServerArchiveAuditParams): AuditInput[] {
  const t = params.serverId;
  const entries: AuditInput[] = [
    { action: 'deprovision.serverArchive.requested', actor: params.actor, target: t },
  ];

  if (params.outcome === 'blocked') {
    entries.push({ action: 'deprovision.serverArchive.blocked', actor: params.actor, target: t, result: 'failure' });
    return entries;
  }

  entries.push({ action: 'deprovision.serverArchive.confirmed', actor: params.actor, target: t });

  if (params.credentialDecision === 'remove') {
    entries.push({ action: 'deprovision.credentials.removeConfirmed', actor: params.actor, target: t });
    entries.push({ action: 'deprovision.credentials.removed', actor: params.actor, target: t });
  } else {
    entries.push({ action: 'deprovision.credentials.keepConfirmed', actor: params.actor, target: t });
  }

  entries.push({ action: 'deprovision.server.archived', actor: params.actor, target: t });
  entries.push({ action: 'deprovision.serverArchive.completed', actor: params.actor, target: t });
  return entries;
}
