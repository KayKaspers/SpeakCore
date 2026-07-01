/**
 * Reine Helfer für den managed Container-Start (NDF Step 018) – unit-testbar, ohne DB/Agent.
 */
import type { AuditInput } from './audit';

export type ContainerStartServiceStatus =
  | 'started'
  | 'running'
  | 'notFound'
  | 'invalidState'
  | 'licenseRequired'
  | 'invalidPlan'
  | 'writeDisabled'
  | 'unavailable'
  | 'unreachable'
  | 'conflict'
  | 'error';

export interface ContainerStartServiceResult {
  status: ContainerStartServiceStatus;
  serverId?: string;
  containerName?: string;
}

/**
 * Status-Guard: nur `CONTAINER_CREATED` (starten) und `RUNNING` (idempotent) sind erlaubt.
 * DRAFT/RESOURCES_PREPARED/CONTAINER_PENDING/ERROR sowie external (null) ⇒ ungültig.
 */
export function resolveContainerStart(provisioningStatus: string | null): 'ok' | 'invalidState' {
  if (provisioningStatus === 'CONTAINER_CREATED' || provisioningStatus === 'RUNNING') return 'ok';
  return 'invalidState';
}

export type ContainerStartAuditKind = 'started' | 'running' | 'conflict' | 'failed';

/**
 * Audit-Events (keine Secrets/ENV/Roh-Docker-Ausgabe, Target = ServerInstance-ID).
 * `licenseConfirmed` erzeugt genau dann ein `licenseConfirmed`-Event, wenn der Nutzer zugestimmt hat.
 */
export function buildContainerStartAuditEntries(
  kind: ContainerStartAuditKind,
  actor: string,
  serverId: string,
  licenseConfirmed: boolean,
): AuditInput[] {
  const entries: AuditInput[] = [
    { action: 'docker.containerStart.requested', actor, target: serverId },
  ];
  if (licenseConfirmed) {
    entries.push({ action: 'docker.containerStart.licenseConfirmed', actor, target: serverId });
  }
  if (kind === 'started') {
    entries.push({ action: 'docker.container.started', actor, target: serverId });
    entries.push({ action: 'docker.containerStart.completed', actor, target: serverId });
  } else if (kind === 'running') {
    entries.push({ action: 'docker.container.alreadyRunning', actor, target: serverId });
    entries.push({ action: 'docker.containerStart.completed', actor, target: serverId });
  } else if (kind === 'conflict') {
    entries.push({ action: 'docker.containerStart.conflict', actor, target: serverId, result: 'failure' });
    entries.push({ action: 'docker.containerStart.failed', actor, target: serverId, result: 'failure' });
  } else {
    entries.push({ action: 'docker.containerStart.failed', actor, target: serverId, result: 'failure' });
  }
  return entries;
}

/** Generischer i18n-Fehlerschlüssel für den persistierten Provisioning-State (kein Secret/Detail). */
export function containerStartErrorKey(status: ContainerStartServiceStatus): string | null {
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
      return 'startFailed';
    case 'invalidPlan':
      return 'invalidPlan';
    default:
      return null;
  }
}
