/**
 * Backup-**Delete/Rotation**-Blueprint (NDF Step 039) – **reine Planungs-/Guard-Logik, KEIN Löschen**.
 *
 * In diesem Step wird **keine einzige Datei entfernt**: keine Agent-/Web-Route, keine Datei-/DB-
 * Operation, keine Wildcards, keine Ordner, keine Scheduler/Background-Jobs. Diese Funktionen
 * bewerten nur, **ob** ein späteres gezieltes Einzel-Delete erlaubt wäre (irreversibel!), **welche
 * Bestätigungen** fehlen und **was** eine spätere Rotation als **Dry-Run** löschen WÜRDE.
 * `executable` ist immer `false`.
 *
 * Bewusste Regel: **Verify ist für Delete KEIN Blocker** (auch defekte/alte Backups müssen löschbar
 * bleiben) – Verify-/Metadaten-/Checksum-Probleme erscheinen als **Warnungen**.
 */
import type {
  BackupDeleteConfirmations,
  BackupDeleteEvaluation,
  BackupDeleteState,
  BackupRotationConfirmations,
  BackupRotationEntry,
  BackupRotationEvaluation,
  BackupRotationPolicy,
} from '@speakcore/types';
import { isValidInstanceId } from './validate';

/** Getippte Bestätigung für das spätere Einzel-Delete (irreversibel, bewusster Schritt). */
export const BACKUP_DELETE_TYPED_CONFIRMATION = 'DELETE BACKUP';

/** Getippte Bestätigung für spätere Bulk-Rotation (in 0.1 nie ausführbar). */
export const BACKUP_ROTATION_TYPED_CONFIRMATION = 'DELETE BACKUPS';

/** Ab dieser Dateigröße wird beim Delete zusätzlich gewarnt (1 GiB). */
export const BACKUP_DELETE_LARGE_FILE_BYTES = 1024 * 1024 * 1024;

/** Vorgesehene Audit-Events fürs spätere Einzel-Delete (kein Inhalt, kein Dateiname). */
export const BACKUP_DELETE_AUDIT = {
  requested: 'backup.managedVolume.delete.requested',
  blocked: 'backup.managedVolume.delete.blocked',
  confirmed: 'backup.managedVolume.delete.confirmed',
  started: 'backup.managedVolume.delete.started',
  completed: 'backup.managedVolume.delete.completed',
  failed: 'backup.managedVolume.delete.failed',
} as const;

/** Vorgesehene Audit-Events für die spätere Rotation (Plan/Dry-Run zuerst). */
export const BACKUP_ROTATION_AUDIT = {
  planCreated: 'backup.managedVolume.rotation.planCreated',
  blocked: 'backup.managedVolume.rotation.blocked',
  confirmed: 'backup.managedVolume.rotation.confirmed',
} as const;

/** Default-Policy fürs Dry-Run-Konzept (kein automatisches Löschen, keine Scheduler). */
export const DEFAULT_BACKUP_ROTATION_POLICY: BackupRotationPolicy = {
  keepLastCount: 3,
  keepMinAgeDays: 7,
  protectLastVerifiedBackup: true,
  protectOnlyBackup: true,
  dryRun: true,
};

/** Strikter Zeitstempel wie ihn Step 032 erzeugt (ISO, `:`/`.` → `-`). */
const TIMESTAMP_PATTERN = '\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z';

/** Reine Dateinamen-Prüfung gegen das Instanz-Muster (kein `/`, kein `\`, kein `..`). */
export function isDeletableBackupFileName(instanceId: string, fileName: unknown): boolean {
  if (typeof fileName !== 'string') return false;
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return false;
  return new RegExp(`^speakcore-backup-ts3-${instanceId}-(${TIMESTAMP_PATTERN})\\.tar\\.gz$`).test(fileName);
}

/** Schnelle Request-Validierung (Teilmenge des Guards, ohne Bestätigungen). */
export function validateBackupDeleteRequest(state: BackupDeleteState): {
  valid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (state.mode !== 'managed') reasons.push('notManaged');
  if (!isValidInstanceId(state.instanceId)) reasons.push('instanceIdInvalid');
  if (state.actorRole !== 'OWNER') reasons.push('ownerRequired');
  if (!isDeletableBackupFileName(state.instanceId, state.fileName)) reasons.push('fileNameInvalid');
  return { valid: reasons.length === 0, reasons };
}

export interface BackupDeleteGuardResult {
  allowed: boolean;
  blockedReasons: string[];
  requiredConfirmations: string[];
  warnings: string[];
}

/**
 * Reiner Guard: wäre ein späteres gezieltes Einzel-Delete erlaubt? Verify-/Metadaten-/Checksum-
 * Probleme, „einziges Backup", archivierter Server und Dateigröße sind **Warnungen** (kein Blocker).
 */
export function canDeleteManagedBackup(
  state: BackupDeleteState,
  confirmations: BackupDeleteConfirmations,
): BackupDeleteGuardResult {
  const { reasons } = validateBackupDeleteRequest(state);
  const blockedReasons = [...reasons];
  const requiredConfirmations: string[] = [];
  const warnings: string[] = [];

  if (!state.backupExists) blockedReasons.push('backupNotFound');

  if (confirmations.confirmBackupDeletion !== true) {
    requiredConfirmations.push('confirmBackupDeletion');
  }
  if (confirmations.confirmBackupMayBeOnlyCopy !== true) {
    requiredConfirmations.push('confirmBackupMayBeOnlyCopy');
  }
  if (confirmations.confirmNoRestoreWithoutBackup !== true) {
    requiredConfirmations.push('confirmNoRestoreWithoutBackup');
  }
  if (
    confirmations.typedConfirmation !== undefined &&
    confirmations.typedConfirmation !== BACKUP_DELETE_TYPED_CONFIRMATION
  ) {
    blockedReasons.push('typedConfirmationMismatch');
  }

  // Warnungen – bewusst KEINE Blocker (auch defekte/alte Backups müssen löschbar bleiben):
  if (state.verifyStatus === 'mismatch') warnings.push('verifyMismatch');
  else if (state.verifyStatus === 'notVerified') warnings.push('neverVerified');
  if (state.metadataStatus === 'missing') warnings.push('metadataMissing');
  if (state.metadataStatus === 'invalid') warnings.push('metadataInvalid');
  if (!state.checksumPresent) warnings.push('checksumMissing');
  if (state.isOnlyBackup) warnings.push('onlyBackup');
  if (state.archived) warnings.push('serverArchived');
  if (state.sizeBytes !== null && state.sizeBytes >= BACKUP_DELETE_LARGE_FILE_BYTES) {
    warnings.push('largeFile');
  }

  const unique = [...new Set(blockedReasons)];
  return {
    allowed: unique.length === 0 && requiredConfirmations.length === 0,
    blockedReasons: unique,
    requiredConfirmations,
    warnings: [...new Set(warnings)],
  };
}

/**
 * Vollständiger Delete-**Plan** (rein, `executable: false`). Löschziel wäre **genau eine** Datei
 * plus ihre exakt abgeleitete metadata.json – nie Wildcards, nie Ordner, nie fremde Dateien.
 */
export function buildBackupDeletePlan(
  state: BackupDeleteState,
  confirmations: BackupDeleteConfirmations,
): BackupDeleteEvaluation {
  const guard = canDeleteManagedBackup(state, confirmations);
  return {
    decision: guard.allowed ? 'allowed' : 'blocked',
    blockedReasons: guard.blockedReasons,
    requiredConfirmations: guard.requiredConfirmations,
    warnings: guard.warnings,
    dataLossRisk: 'irreversible',
    plannedActions: [
      {
        action: 'DELETE_MANAGED_BACKUP',
        targetKind: 'backupFile',
        deletesMetadataFile: true,
        wildcardsAllowed: false,
      },
    ],
    retentionPolicy: null,
    auditEvents: Object.values(BACKUP_DELETE_AUDIT),
    nextRecommendedStep: guard.allowed
      ? 'Echtes Einzel-Delete implementieren (eigener, abgesicherter Step) – danach Rotation-Dry-Run'
      : 'Blockierende Voraussetzungen/Bestätigungen beheben – kein Löschen in 0.1',
    executable: false,
  };
}

function ageDays(createdAt: string, now: Date): number {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return 0;
  return (now.getTime() - created) / (24 * 60 * 60 * 1000);
}

/**
 * Rotations-**Dry-Run** (rein): berechnet, welche Backups eine spätere Rotation löschen WÜRDE.
 * Schutzreihenfolge: einziges Backup → letzte `keepLastCount` (neueste zuerst) → jünger als
 * `keepMinAgeDays` → letztes verifiziertes Backup. Kandidaten müssen zusätzlich älter als
 * `deleteOlderThanDays` sein, falls gesetzt. **Es wird nie gelöscht** (`executable: false`).
 */
export function buildBackupRotationPlan(
  backups: BackupRotationEntry[],
  policy: BackupRotationPolicy,
  confirmations: BackupRotationConfirmations,
  now: Date = new Date(),
): BackupRotationEvaluation {
  const blockedReasons: string[] = [];
  const requiredConfirmations: string[] = [];
  const warnings: string[] = [];

  if (confirmations.confirmRotationPolicyReviewed !== true) {
    requiredConfirmations.push('confirmRotationPolicyReviewed');
  }
  if (confirmations.confirmBulkDeletionRisk !== true) {
    requiredConfirmations.push('confirmBulkDeletionRisk');
  }
  if (
    confirmations.typedConfirmation !== undefined &&
    confirmations.typedConfirmation !== BACKUP_ROTATION_TYPED_CONFIRMATION
  ) {
    blockedReasons.push('typedConfirmationMismatch');
  }

  // Neueste zuerst (createdAt, Fallback Dateiname – der Zeitstempel steckt im Namen).
  const sorted = [...backups].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.fileName.localeCompare(a.fileName),
  );

  const protectedBy = new Map<string, string[]>();
  const protect = (fileName: string, reason: string) => {
    protectedBy.set(fileName, [...(protectedBy.get(fileName) ?? []), reason]);
  };

  if (policy.protectOnlyBackup && sorted.length === 1) {
    protect(sorted[0].fileName, 'onlyBackup');
  }
  const keepLast = policy.keepLastCount ?? 0;
  sorted.slice(0, keepLast).forEach((b) => protect(b.fileName, 'keepLastCount'));
  if (policy.keepMinAgeDays !== undefined) {
    for (const b of sorted) {
      if (ageDays(b.createdAt, now) < policy.keepMinAgeDays) protect(b.fileName, 'keepMinAgeDays');
    }
  }
  if (policy.protectLastVerifiedBackup) {
    const lastVerified = sorted.find((b) => b.verified === true);
    if (lastVerified) protect(lastVerified.fileName, 'lastVerifiedBackup');
  }

  const deleteCandidates: string[] = [];
  const kept: Array<{ fileName: string; protectedBy: string[] }> = [];
  for (const b of sorted) {
    const protection = protectedBy.get(b.fileName);
    if (protection) {
      kept.push({ fileName: b.fileName, protectedBy: protection });
      continue;
    }
    if (policy.deleteOlderThanDays !== undefined && ageDays(b.createdAt, now) <= policy.deleteOlderThanDays) {
      kept.push({ fileName: b.fileName, protectedBy: ['notOldEnough'] });
      continue;
    }
    deleteCandidates.push(b.fileName);
  }

  if (deleteCandidates.length === backups.length && backups.length > 0) {
    warnings.push('wouldDeleteAllBackups');
  }

  return {
    decision:
      blockedReasons.length === 0 && requiredConfirmations.length === 0 ? 'dryRun' : 'blocked',
    blockedReasons,
    requiredConfirmations,
    warnings,
    deleteCandidates,
    kept,
    dryRun: true,
    auditEvents: Object.values(BACKUP_ROTATION_AUDIT),
    executable: false,
  };
}
