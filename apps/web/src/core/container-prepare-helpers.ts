/**
 * Reine Helfer für die Container-Vorbereitung (NDF Step 015) – unit-testbar, ohne DB/Crypto.
 */
import type { AuditInput } from './audit';

export type ContainerPrepareStatus =
  | 'pending'
  | 'alreadyPending'
  | 'invalidState'
  | 'encryptionMissing'
  | 'invalidPlan'
  | 'notFound';

export interface ContainerPrepareResult {
  status: ContainerPrepareStatus;
  serverId?: string;
}

/** Status-Guard: nur RESOURCES_PREPARED darf vorbereiten; CONTAINER_PENDING ist idempotent. */
export function resolveContainerPrepare(
  provisioningStatus: string | null,
): 'ok' | 'alreadyPending' | 'invalidState' {
  if (provisioningStatus === 'RESOURCES_PREPARED') return 'ok';
  if (provisioningStatus === 'CONTAINER_PENDING') return 'alreadyPending';
  return 'invalidState';
}

/** Audit-Events (keine Secrets, Target = ServerInstance-ID). */
export function buildContainerPrepareAuditEntries(
  outcome: 'completed' | 'failed' | 'alreadyPending',
  actor: string,
  serverId: string,
  secretCreated: boolean,
): AuditInput[] {
  const entries: AuditInput[] = [
    { action: 'ts3.containerPrepare.requested', actor, target: serverId },
  ];
  if (secretCreated) {
    entries.push({ action: 'ts3.containerPrepare.secretCreated', actor, target: serverId });
  }
  if (outcome === 'failed') {
    entries.push({ action: 'ts3.containerPrepare.failed', actor, target: serverId, result: 'failure' });
  } else {
    entries.push({ action: 'ts3.containerPrepare.completed', actor, target: serverId });
  }
  return entries;
}
