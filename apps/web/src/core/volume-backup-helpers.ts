/**
 * Reine Helfer für das managed Volume-Backup (NDF Step 032) – unit-testbar, ohne DB/Agent.
 *
 * Die Bestätigungs-Vorprüfung nutzt die **Step-030-Guard-Logik** `canBackupManagedVolume`. Die reale
 * Existenz-/Ausführungsprüfung macht der Agent (Defense-in-Depth). Keine Docker-Ausführung, keine Secrets.
 */
import { canBackupManagedVolume } from '@speakcore/shared';
import type { AuditInput } from './audit';

export interface BackupConfirmations {
  confirmBackupMayContainSensitiveData?: boolean;
  confirmBackupStorageResponsibility?: boolean;
  confirmContainerShouldBeStopped?: boolean;
  typedConfirmation?: string;
}

export type VolumeBackupServiceStatus =
  | 'created'
  | 'notFound'
  | 'notManaged'
  | 'archived'
  | 'invalidState'
  | 'sensitiveDataRequired'
  | 'storageRequired'
  | 'containerStoppedRequired'
  | 'typedMismatch'
  | 'containerStillExists'
  | 'volumeNotFound'
  | 'volumeNotManaged'
  | 'backupDirUnavailable'
  | 'imageUnavailable'
  | 'writeDisabled'
  | 'unavailable'
  | 'unreachable'
  | 'error';

export interface VolumeBackupServiceResult {
  status: VolumeBackupServiceStatus;
  serverId?: string;
  backupFileName?: string;
}

/**
 * Web-Vorprüfung der Bestätigungen über den Step-030-Guard (optimistische Existenz; der Agent re-verifiziert
 * Container/Volume/Image real). Liefert `ok` oder den fehlenden Grund.
 */
export function mapBackupConfirmationGuard(
  confirmations: BackupConfirmations,
):
  | 'ok'
  | 'sensitiveDataRequired'
  | 'storageRequired'
  | 'containerStoppedRequired'
  | 'typedMismatch' {
  const guard = canBackupManagedVolume(
    {
      instanceId: 'placeholder',
      mode: 'managed',
      provisioningStatus: 'RESOURCES_PREPARED',
      runState: null,
      serverDisplayName: '',
      managedVolumeName: null,
      managedVolumeState: null,
      volume: { exists: true, managed: true },
      container: { exists: false, running: false },
    },
    confirmations,
  );
  if (guard.requiredConfirmations.includes('confirmBackupMayContainSensitiveData')) return 'sensitiveDataRequired';
  if (guard.requiredConfirmations.includes('confirmBackupStorageResponsibility')) return 'storageRequired';
  if (guard.requiredConfirmations.includes('confirmContainerShouldBeStopped')) return 'containerStoppedRequired';
  if (guard.blockedReasons.includes('typedConfirmationMismatch')) return 'typedMismatch';
  return 'ok';
}

export type VolumeBackupAuditOutcome = 'blocked' | 'agentBlocked' | 'created' | 'failed';

/** Audit-Events (keine Secrets/Backup-Inhalt/Roh-Docker-Ausgabe, Target = ServerInstance-ID). */
export function buildVolumeBackupAuditEntries(
  outcome: VolumeBackupAuditOutcome,
  actor: string,
  serverId: string,
): AuditInput[] {
  const t = serverId;
  const entries: AuditInput[] = [{ action: 'backup.managedVolume.requested', actor, target: t }];

  if (outcome === 'blocked') {
    entries.push({ action: 'backup.managedVolume.blocked', actor, target: t, result: 'failure' });
    return entries;
  }

  entries.push({ action: 'backup.managedVolume.confirmed', actor, target: t });

  if (outcome === 'agentBlocked') {
    entries.push({ action: 'backup.managedVolume.blocked', actor, target: t, result: 'failure' });
    return entries;
  }

  entries.push({ action: 'backup.managedVolume.started', actor, target: t });
  if (outcome === 'created') {
    entries.push({ action: 'backup.managedVolume.completed', actor, target: t });
  } else {
    entries.push({ action: 'backup.managedVolume.failed', actor, target: t, result: 'failure' });
  }
  return entries;
}
