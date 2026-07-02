/**
 * Backup-**Download**-Blueprint (NDF Step 036) – **reine Planungs-/Guard-Logik, KEIN Download**.
 *
 * In diesem Step verlässt **kein einziges Backup-Byte** das System: **kein** Streaming, **keine**
 * Download-Route, **keine** Datei-/DB-/Agent-Operation, **keine** Secrets. Diese Funktionen bewerten
 * nur, **ob** ein späterer echter Download erlaubt wäre, **welche Bestätigungen** fehlen und **wie**
 * das Zielbild aussieht (Web-proxied Streaming, nie Browser→Agent). `executable` ist immer `false`.
 *
 * Harte Regel: **Verify vor Download** – ohne `valid`-Verifikation (Step 035) wird nie geplant.
 */
import type {
  BackupDownloadConfirmations,
  BackupDownloadEvaluation,
  BackupDownloadPlannedFlow,
  BackupDownloadRateLimitPolicy,
  BackupDownloadSizeLimitPolicy,
  BackupDownloadState,
} from '@speakcore/types';
import { isValidInstanceId } from './validate';

/** Getippte Bestätigung für den späteren echten Download (bewusster Schritt, sensible Daten). */
export const BACKUP_DOWNLOAD_TYPED_CONFIRMATION = 'DOWNLOAD BACKUP';

/** Ab dieser Dateigröße ist eine explizite Warnung vorgesehen (1 GiB). */
export const BACKUP_DOWNLOAD_WARN_AT_BYTES = 1024 * 1024 * 1024;

/** Vorgesehene Audit-Events für den späteren echten Download (kein Inhalt, kein Dateiname). */
export const BACKUP_DOWNLOAD_AUDIT = {
  requested: 'backup.managedVolume.download.requested',
  blocked: 'backup.managedVolume.download.blocked',
  confirmed: 'backup.managedVolume.download.confirmed',
  started: 'backup.managedVolume.download.started',
  completed: 'backup.managedVolume.download.completed',
  failed: 'backup.managedVolume.download.failed',
} as const;

/** Rate-Limit-Konzept (nur modelliert; Durchsetzung erst im echten Download-Step). */
export const BACKUP_DOWNLOAD_RATE_LIMIT_POLICY: BackupDownloadRateLimitPolicy = {
  scope: 'ownerAndServer',
  maxDownloadsPerHour: 5,
  maxDownloadsPerDay: 20,
  timeoutMs: 600_000,
};

/** Größen-Konzept: Streaming statt Komplett-Einlesen, Warnung ab 1 GiB (nur modelliert). */
export const BACKUP_DOWNLOAD_SIZE_LIMIT_POLICY: BackupDownloadSizeLimitPolicy = {
  warnAtBytes: BACKUP_DOWNLOAD_WARN_AT_BYTES,
  streamingRequired: true,
};

/** Strikter Zeitstempel wie ihn Step 032 erzeugt (ISO, `:`/`.` → `-`). */
const TIMESTAMP_PATTERN = '\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z';

/** Reine Dateinamen-Prüfung gegen das Instanz-Muster (kein `/`, kein `\`, kein `..`). */
export function isDownloadableBackupFileName(instanceId: string, fileName: unknown): boolean {
  if (typeof fileName !== 'string') return false;
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return false;
  return new RegExp(`^speakcore-backup-ts3-${instanceId}-(${TIMESTAMP_PATTERN})\\.tar\\.gz$`).test(fileName);
}

export interface BackupDownloadGuardResult {
  allowed: boolean;
  blockedReasons: string[];
  requiredConfirmations: string[];
  warnings: string[];
}

/** Schnelle Request-Validierung (Teilmenge des Guards, ohne Bestätigungen). */
export function validateBackupDownloadRequest(state: BackupDownloadState): {
  valid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (state.mode !== 'managed') reasons.push('notManaged');
  if (!isValidInstanceId(state.instanceId)) reasons.push('instanceIdInvalid');
  if (state.actorRole !== 'OWNER') reasons.push('ownerRequired');
  if (!isDownloadableBackupFileName(state.instanceId, state.fileName)) reasons.push('fileNameInvalid');
  return { valid: reasons.length === 0, reasons };
}

/**
 * Reiner Guard: wäre ein späterer echter Download erlaubt? **Verify `valid` ist harte
 * Voraussetzung** – `mismatch`, „nicht verifiziert" und fehlende Prüfsumme blockieren immer.
 */
export function canDownloadManagedBackup(
  state: BackupDownloadState,
  confirmations: BackupDownloadConfirmations,
): BackupDownloadGuardResult {
  const { reasons } = validateBackupDownloadRequest(state);
  const blockedReasons = [...reasons];
  const requiredConfirmations: string[] = [];
  const warnings: string[] = [];

  if (!state.backupExists) blockedReasons.push('backupNotFound');
  if (state.metadataStatus === 'missing') blockedReasons.push('metadataMissing');
  if (state.metadataStatus === 'invalid') blockedReasons.push('metadataInvalid');
  if (!state.checksumPresent) blockedReasons.push('checksumMissing');

  // Harte Regel: Verify vor Download (Step 035 muss `valid` ergeben haben).
  if (state.verifyStatus === 'mismatch') blockedReasons.push('verifyMismatch');
  else if (state.verifyStatus === 'checksumMissing') blockedReasons.push('checksumMissing');
  else if (state.verifyStatus !== 'valid') blockedReasons.push('verifyRequired');

  if (state.rateLimited) blockedReasons.push('rateLimited');

  if (confirmations.confirmBackupContainsSensitiveData !== true) {
    requiredConfirmations.push('confirmBackupContainsSensitiveData');
  }
  if (confirmations.confirmSecureStorageResponsibility !== true) {
    requiredConfirmations.push('confirmSecureStorageResponsibility');
  }
  if (
    confirmations.typedConfirmation !== undefined &&
    confirmations.typedConfirmation !== BACKUP_DOWNLOAD_TYPED_CONFIRMATION
  ) {
    blockedReasons.push('typedConfirmationMismatch');
  }

  if (state.archived) warnings.push('serverArchived');
  if (state.sizeBytes !== null && state.sizeBytes >= BACKUP_DOWNLOAD_WARN_AT_BYTES) {
    warnings.push('largeFile');
  }
  if (state.sizeBytes === null) warnings.push('sizeUnknown');

  // dedupe (checksumMissing kann doppelt auftreten)
  const unique = [...new Set(blockedReasons)];

  return {
    allowed: unique.length === 0 && requiredConfirmations.length === 0,
    blockedReasons: unique,
    requiredConfirmations,
    warnings,
  };
}

/** Deklaratives Streaming-Zielbild (Option A): Web-proxied, nie Browser→Agent, kein Buffering. */
export function buildBackupDownloadFlow(): BackupDownloadPlannedFlow {
  return {
    kind: 'webProxiedStreaming',
    steps: [
      'Browser: OWNER fordert Download mit Bestätigungen an',
      'Web-Server: authentifiziert OWNER, prüft Guards (Verify valid, Metadaten, Rate-Limit)',
      'Web-Server: serverseitiger Agent-Call mit Token (nie aus dem Browser)',
      'Agent: kontrolliertes Streaming aus dem serverseitigen Backup-Verzeichnis',
      'Web-Server: reicht den Stream ohne Zwischenspeicherung an den Browser weiter',
      'Audit: Ereignisse ohne Inhalt/Dateiname',
    ],
    browserToAgentDirect: false,
    bufferingAllowed: false,
  };
}

/**
 * Vollständiger Download-**Plan** (rein, `executable: false`). Enthält Guard-Ergebnis, Zielbild,
 * Policies und Audit-Konzept – **keine** Datei-/DB-/Agent-Operation, **keine** Secrets/Host-Pfade.
 */
export function buildBackupDownloadPlan(
  state: BackupDownloadState,
  confirmations: BackupDownloadConfirmations,
): BackupDownloadEvaluation {
  const guard = canDownloadManagedBackup(state, confirmations);
  return {
    decision: guard.allowed ? 'allowed' : 'blocked',
    blockedReasons: guard.blockedReasons,
    requiredConfirmations: guard.requiredConfirmations,
    warnings: guard.warnings,
    dataSensitivity: 'sensitive',
    plannedFlow: buildBackupDownloadFlow(),
    auditEvents: Object.values(BACKUP_DOWNLOAD_AUDIT),
    rateLimitPolicy: BACKUP_DOWNLOAD_RATE_LIMIT_POLICY,
    sizeLimitPolicy: BACKUP_DOWNLOAD_SIZE_LIMIT_POLICY,
    nextRecommendedStep: guard.allowed
      ? 'Web-proxied Streaming-Download implementieren (eigener, abgesicherter Step)'
      : 'Blockierende Voraussetzungen beheben (z. B. Verify ausführen) – kein Download in 0.1',
    executable: false,
  };
}
