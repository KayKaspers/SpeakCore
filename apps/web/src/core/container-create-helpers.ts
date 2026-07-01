/**
 * Reine Helfer für die managed Container-Erstellung (NDF Step 017) – unit-testbar, ohne DB/Agent/Crypto.
 */
import type { AuditInput } from './audit';

export type ContainerCreateServiceStatus =
  | 'created'
  | 'exists'
  | 'notFound'
  | 'invalidState'
  | 'encryptionMissing'
  | 'credentialMissing'
  | 'invalidPlan'
  | 'writeDisabled'
  | 'unavailable'
  | 'unreachable'
  | 'conflict'
  | 'error';

export interface ContainerCreateServiceResult {
  status: ContainerCreateServiceStatus;
  serverId?: string;
  containerName?: string;
}

/**
 * Status-Guard für die Container-Erstellung. Nur `CONTAINER_PENDING` (erstellen) und
 * `CONTAINER_CREATED` (idempotent erneut) sind erlaubt. Alle anderen Zustände (DRAFT,
 * RESOURCES_PREPARED, RESOURCE_PREPARE_*, ERROR, RUNNING, external ⇒ null) sind ungültig.
 */
export function resolveContainerCreate(provisioningStatus: string | null): 'ok' | 'invalidState' {
  if (provisioningStatus === 'CONTAINER_PENDING' || provisioningStatus === 'CONTAINER_CREATED') {
    return 'ok';
  }
  return 'invalidState';
}

export type ContainerCreateAuditKind = 'created' | 'exists' | 'conflict' | 'failed';

/** Audit-Events (keine Secrets, keine Roh-Docker-Ausgabe, Target = ServerInstance-ID). */
export function buildContainerCreateAuditEntries(
  kind: ContainerCreateAuditKind,
  actor: string,
  serverId: string,
): AuditInput[] {
  const entries: AuditInput[] = [
    { action: 'docker.containerCreate.requested', actor, target: serverId },
  ];
  if (kind === 'created') {
    entries.push({ action: 'docker.container.created', actor, target: serverId });
    entries.push({ action: 'docker.containerCreate.completed', actor, target: serverId });
  } else if (kind === 'exists') {
    entries.push({ action: 'docker.container.exists', actor, target: serverId });
    entries.push({ action: 'docker.containerCreate.completed', actor, target: serverId });
  } else if (kind === 'conflict') {
    entries.push({ action: 'docker.container.conflict', actor, target: serverId, result: 'failure' });
    entries.push({ action: 'docker.containerCreate.failed', actor, target: serverId, result: 'failure' });
  } else {
    entries.push({ action: 'docker.containerCreate.failed', actor, target: serverId, result: 'failure' });
  }
  return entries;
}

/** Generischer i18n-Fehlerschlüssel für den persistierten Provisioning-State (kein Secret/Detail). */
export function containerCreateErrorKey(status: ContainerCreateServiceStatus): string | null {
  switch (status) {
    case 'writeDisabled':
      return 'writeDisabled';
    case 'unavailable':
      return 'unavailable';
    case 'unreachable':
      return 'unreachable';
    case 'conflict':
      return 'conflict';
    case 'error':
      return 'createFailed';
    case 'invalidPlan':
      return 'invalidPlan';
    default:
      return null;
  }
}
