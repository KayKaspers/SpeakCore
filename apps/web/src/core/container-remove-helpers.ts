/**
 * Reine Helfer für das managed Container-Remove (NDF Step 022) – unit-testbar, ohne DB/Agent.
 */
import type { AuditInput } from './audit';

export type ContainerRemoveServiceStatus =
  | 'removed'
  | 'alreadyRemoved'
  | 'stillRunning'
  | 'notFound'
  | 'invalidState'
  | 'invalidPlan'
  | 'writeDisabled'
  | 'unavailable'
  | 'unreachable'
  | 'conflict'
  | 'error';

export interface ContainerRemoveServiceResult {
  status: ContainerRemoveServiceStatus;
  serverId?: string;
  containerName?: string;
}

/**
 * Status-Guard: `CONTAINER_CREATED`/`RESOURCES_PREPARED` dürfen entfernen (idempotent);
 * `RUNNING` ⇒ `running` (zuerst stoppen); alles andere ⇒ `invalidState`.
 */
export function resolveContainerRemove(
  provisioningStatus: string | null,
): 'ok' | 'running' | 'invalidState' {
  if (provisioningStatus === 'CONTAINER_CREATED' || provisioningStatus === 'RESOURCES_PREPARED') {
    return 'ok';
  }
  if (provisioningStatus === 'RUNNING') return 'running';
  return 'invalidState';
}

/**
 * Persistierte Felder nach erfolgreichem Remove. **Enthält bewusst KEINE** `credential`/
 * `managedVolumeName`/`managedNetworkName` – diese bleiben unberührt (kein Löschen). Der Container gilt
 * als nicht mehr vorhanden ⇒ `runState='unknown'`; `provisioningStatus` zurück auf `RESOURCES_PREPARED`.
 */
export function removeSuccessUpdate(): {
  provisioningStatus: 'RESOURCES_PREPARED';
  runState: 'unknown';
  lastProvisioningStep: 'REMOVE_CONTAINER';
  lastProvisioningErrorKey: null;
} {
  return {
    provisioningStatus: 'RESOURCES_PREPARED',
    runState: 'unknown',
    lastProvisioningStep: 'REMOVE_CONTAINER',
    lastProvisioningErrorKey: null,
  };
}

export type ContainerRemoveAuditKind =
  | 'removed'
  | 'alreadyRemoved'
  | 'stillRunning'
  | 'conflict'
  | 'failed';

/** Audit-Events (keine Secrets/ENV/Roh-Docker-Ausgabe, Target = ServerInstance-ID). */
export function buildContainerRemoveAuditEntries(
  kind: ContainerRemoveAuditKind,
  actor: string,
  serverId: string,
): AuditInput[] {
  const entries: AuditInput[] = [
    { action: 'docker.containerRemove.requested', actor, target: serverId },
  ];
  if (kind === 'removed') {
    entries.push({ action: 'docker.container.removed', actor, target: serverId });
    entries.push({ action: 'docker.containerRemove.completed', actor, target: serverId });
  } else if (kind === 'alreadyRemoved') {
    entries.push({ action: 'docker.container.alreadyRemoved', actor, target: serverId });
    entries.push({ action: 'docker.containerRemove.completed', actor, target: serverId });
  } else if (kind === 'stillRunning') {
    entries.push({ action: 'docker.containerRemove.stillRunning', actor, target: serverId, result: 'failure' });
    entries.push({ action: 'docker.containerRemove.failed', actor, target: serverId, result: 'failure' });
  } else if (kind === 'conflict') {
    entries.push({ action: 'docker.containerRemove.conflict', actor, target: serverId, result: 'failure' });
    entries.push({ action: 'docker.containerRemove.failed', actor, target: serverId, result: 'failure' });
  } else {
    entries.push({ action: 'docker.containerRemove.failed', actor, target: serverId, result: 'failure' });
  }
  return entries;
}

/** Generischer i18n-Fehlerschlüssel für den persistierten Provisioning-State (kein Secret/Detail). */
export function containerRemoveErrorKey(status: ContainerRemoveServiceStatus): string | null {
  switch (status) {
    case 'stillRunning':
      return 'stillRunning';
    case 'writeDisabled':
      return 'writeDisabled';
    case 'unavailable':
      return 'unavailable';
    case 'unreachable':
      return 'unreachable';
    case 'conflict':
      return 'conflict';
    case 'error':
      return 'removeFailed';
    case 'invalidPlan':
      return 'invalidPlan';
    default:
      return null;
  }
}
