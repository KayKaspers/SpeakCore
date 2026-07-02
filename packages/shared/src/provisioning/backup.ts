/**
 * Managed-TS3-Volume Backup **Blueprint** (NDF Step 030) – **reine Planungs-/Guard-Logik, KEINE Ausführung**.
 *
 * In diesem Step wird **nichts** gesichert: **kein** Docker-Kommando, **kein** Hilfscontainer, **kein**
 * Agent-Aufruf, **kein** Archivfile, **kein** Restore/Import, **kein** DB-Schreiben, **keine** Pfad-/Shell-
 * Verarbeitung. Diese Funktionen bewerten nur, **ob** ein späteres echtes Backup erlaubt wäre, **welche
 * Bestätigungen** fehlen, **welche Sensibilität/Warnungen** gelten und **welche Audit-Events** vorgesehen
 * sind. `executable` ist immer `false`.
 *
 * Der spätere echte Backup-Step würde die **read-only** gemountete Volumequelle über ein streng
 * kontrolliertes, gelabeltes Hilfscontainer-Muster in ein Zielverzeichnis schreiben (Details nur in der
 * Doku – hier bewusst **keine** konkreten Kommandos/Argumente). Backup-Dateien sind **potenziell sensibel**.
 */
import type {
  BackupChecksum,
  BackupMetadata,
  VolumeBackupConfirmations,
  VolumeBackupEvaluation,
  VolumeBackupPlannedAction,
  VolumeBackupRequest,
  VolumeBackupState,
} from '@speakcore/types';
import { defaultVolumeName } from './constants';
import { isValidInstanceId } from './validate';

export const BACKUP_VERSION = 1;

/** Optionale getippte Bestätigung, die (falls angegeben) exakt passen muss. */
export const BACKUP_TYPED_CONFIRMATION = 'CREATE BACKUP';

/** Vorgesehene Audit-Events für spätere echte Backup-Steps (kein Inhalt, Target = ServerInstance-ID). */
export const BACKUP_AUDIT = {
  planCreated: 'backup.managedVolume.planCreated',
  requested: 'backup.managedVolume.requested',
  blocked: 'backup.managedVolume.blocked',
  confirmed: 'backup.managedVolume.confirmed',
  started: 'backup.managedVolume.started',
  completed: 'backup.managedVolume.completed',
  failed: 'backup.managedVolume.failed',
} as const;

/** Dateinamens-**Vorlage** (kein realer Zeitstempel/Pfad). */
export function backupFilenamePattern(instanceId: string): string {
  return `speakcore-backup-ts3-${instanceId}-<timestamp>.tar.gz`;
}

export interface BackupGuardResult {
  allowed: boolean;
  blockedReasons: string[];
  requiredConfirmations: string[];
}

/**
 * Guard für ein späteres Volume-Backup. Nur managed + gültige instanceId + managed Volume vorhanden
 * (nicht `removed`) + Container **nicht laufend** (konservativ) + alle Bestätigungen. Fremde/entfernte
 * Ressourcen werden **nie** als sicherbar geplant.
 */
export function canBackupManagedVolume(
  state: VolumeBackupState,
  confirmations: VolumeBackupConfirmations,
): BackupGuardResult {
  const blockedReasons: string[] = [];
  const requiredConfirmations: string[] = [];

  if (state.mode !== 'managed') blockedReasons.push('notManaged');
  if (!isValidInstanceId(state.instanceId)) blockedReasons.push('instanceIdInvalid');
  if (!state.volume.exists) blockedReasons.push('volumeNotFound');
  else if (!state.volume.managed) blockedReasons.push('volumeNotManaged'); // fremde Ressource: nie sicherbar
  if (state.managedVolumeState === 'removed') blockedReasons.push('volumeRemoved');
  // Konservativ: erster echter Backup-Step nur bei gestopptem Container.
  if (state.container.running) blockedReasons.push('containerRunning');

  if (confirmations.confirmBackupMayContainSensitiveData !== true) {
    requiredConfirmations.push('confirmBackupMayContainSensitiveData');
  }
  if (confirmations.confirmBackupStorageResponsibility !== true) {
    requiredConfirmations.push('confirmBackupStorageResponsibility');
  }
  if (confirmations.confirmContainerShouldBeStopped !== true) {
    requiredConfirmations.push('confirmContainerShouldBeStopped');
  }
  if (
    confirmations.typedConfirmation !== undefined &&
    confirmations.typedConfirmation !== BACKUP_TYPED_CONFIRMATION
  ) {
    blockedReasons.push('typedConfirmationMismatch');
  }

  return {
    allowed: blockedReasons.length === 0 && requiredConfirmations.length === 0,
    blockedReasons,
    requiredConfirmations,
  };
}

/** Quick-Validierung (Guard-Zusammenfassung). */
export function validateManagedVolumeBackupRequest(request: VolumeBackupRequest): {
  decision: 'allowed' | 'blocked';
  blockedReasons: string[];
  requiredConfirmations: string[];
} {
  const g = canBackupManagedVolume(request.state, request.confirmations);
  return { decision: g.allowed ? 'allowed' : 'blocked', blockedReasons: g.blockedReasons, requiredConfirmations: g.requiredConfirmations };
}

/** Baut die (spätere) Backup-Metadaten. **Enthalten selbst keine Secrets**; `containsSecrets: 'unknown'`. */
export function buildBackupMetadata(input: {
  instanceId: string;
  serverDisplayName: string;
  volumeName: string;
  backupFileName?: string;
  /** SHA-256-**Integritäts**prüfsumme (Step 034) – kein Secret; keine Verschlüsselung/Signatur. */
  checksum?: BackupChecksum;
  createdBy?: string;
  createdAt?: string;
  notes?: string[];
}): BackupMetadata {
  return {
    backupVersion: BACKUP_VERSION,
    product: 'SpeakCore',
    kind: 'managed-ts3-volume-backup',
    createdAt: input.createdAt ?? '',
    instanceId: input.instanceId,
    serverDisplayName: input.serverDisplayName,
    volumeName: input.volumeName,
    ...(input.backupFileName ? { backupFileName: input.backupFileName } : {}),
    ...(input.checksum ? { checksum: input.checksum } : {}),
    containsSecrets: 'unknown',
    createdBy: input.createdBy ?? 'owner',
    notes: input.notes ?? [],
  };
}

/**
 * Vollständiger Backup-**Plan** (rein, `executable: false`). Enthält Guard-Ergebnis, Sensibilität,
 * geplante (read-only) Aktion, Dateinamens-Vorlage, Metadaten-Blueprint, Audit-Konzept und Empfehlung.
 */
export function buildManagedVolumeBackupPlan(
  request: VolumeBackupRequest,
  opts: { createdBy?: string; createdAt?: string } = {},
): VolumeBackupEvaluation {
  const { state, confirmations } = request;
  const guard = canBackupManagedVolume(state, confirmations);
  const volumeName = state.managedVolumeName ?? defaultVolumeName(state.instanceId);

  const warnings = ['backupMayContainSensitiveData'];
  if (state.container.running) warnings.push('containerRunningRecommendStop');

  const plannedActions: VolumeBackupPlannedAction[] = [
    { action: 'BACKUP_MANAGED_VOLUME', targetKind: 'volume', managedName: volumeName, readOnlySource: true },
  ];

  const auditEvents = [
    BACKUP_AUDIT.planCreated,
    BACKUP_AUDIT.requested,
    ...(guard.allowed ? [BACKUP_AUDIT.confirmed] : [BACKUP_AUDIT.blocked]),
  ];

  return {
    decision: guard.allowed ? 'allowed' : 'blocked',
    blockedReasons: guard.blockedReasons,
    requiredConfirmations: guard.requiredConfirmations,
    warnings,
    dataSensitivity: 'sensitive',
    plannedActions,
    backupFormat: backupFilenamePattern(state.instanceId),
    backupMetadata: buildBackupMetadata({
      instanceId: state.instanceId,
      serverDisplayName: state.serverDisplayName,
      volumeName,
      createdBy: opts.createdBy,
      createdAt: opts.createdAt,
    }),
    auditEvents,
    // Das echte Backup schreibt NUR in ein Ziel und lässt die Quelle unangetastet (read-only).
    rollbackLimitations: ['backupDoesNotModifySourceVolume'],
    nextRecommendedStep: guard.allowed ? 'realBackupStepStoppedContainer' : 'resolveBlockersFirst',
    executable: false,
  };
}
