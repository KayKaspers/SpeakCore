/**
 * Reine Helfer für den managed Container-Stop (NDF Step 021) – unit-testbar, ohne DB/Agent.
 */
import type { AuditInput } from './audit';

export type ContainerStopServiceStatus =
  | 'stopped'
  | 'alreadyStopped'
  | 'notFound'
  | 'invalidState'
  | 'invalidPlan'
  | 'writeDisabled'
  | 'unavailable'
  | 'unreachable'
  | 'conflict'
  | 'error';

export interface ContainerStopServiceResult {
  status: ContainerStopServiceStatus;
  serverId?: string;
  containerName?: string;
}

/**
 * Status-Guard: nur `RUNNING` (stoppen) und `CONTAINER_CREATED` (idempotent) sind erlaubt.
 * DRAFT/RESOURCES_PREPARED/CONTAINER_PENDING/ERROR sowie external (null) ⇒ ungültig.
 */
export function resolveContainerStop(provisioningStatus: string | null): 'ok' | 'invalidState' {
  if (provisioningStatus === 'RUNNING' || provisioningStatus === 'CONTAINER_CREATED') return 'ok';
  return 'invalidState';
}

export type ContainerStopAuditKind = 'stopped' | 'alreadyStopped' | 'conflict' | 'failed';

/** Audit-Events (keine Secrets/ENV/Roh-Docker-Ausgabe, Target = ServerInstance-ID). */
export function buildContainerStopAuditEntries(
  kind: ContainerStopAuditKind,
  actor: string,
  serverId: string,
): AuditInput[] {
  const entries: AuditInput[] = [
    { action: 'docker.containerStop.requested', actor, target: serverId },
  ];
  if (kind === 'stopped') {
    entries.push({ action: 'docker.container.stopped', actor, target: serverId });
    entries.push({ action: 'docker.containerStop.completed', actor, target: serverId });
  } else if (kind === 'alreadyStopped') {
    entries.push({ action: 'docker.container.alreadyStopped', actor, target: serverId });
    entries.push({ action: 'docker.containerStop.completed', actor, target: serverId });
  } else if (kind === 'conflict') {
    entries.push({ action: 'docker.containerStop.conflict', actor, target: serverId, result: 'failure' });
    entries.push({ action: 'docker.containerStop.failed', actor, target: serverId, result: 'failure' });
  } else {
    entries.push({ action: 'docker.containerStop.failed', actor, target: serverId, result: 'failure' });
  }
  return entries;
}

/** Generischer i18n-Fehlerschlüssel für den persistierten Provisioning-State (kein Secret/Detail). */
export function containerStopErrorKey(status: ContainerStopServiceStatus): string | null {
  switch (status) {
    case 'writeDisabled':
      return 'writeDisabled';
    case 'unavailable':
      return 'unavailable';
    case 'unreachable':
      return 'unreachable';
    case 'conflict':
      return 'conflict';
    case 'notFound':
      return 'notFound';
    case 'error':
      return 'stopFailed';
    case 'invalidPlan':
      return 'invalidPlan';
    default:
      return null;
  }
}
