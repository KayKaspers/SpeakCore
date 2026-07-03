/**
 * Agent Docker Safety Foundation & TS3 Provisioning Blueprint (NDF Step 010).
 *
 * NUR Typ-Verträge für die **spätere** Installation per Agent. In Step 010 wird NICHTS ausgeführt:
 * keine Docker-Aktion, kein Container/Volume/Netzwerk, kein Socket. Diese Typen beschreiben Planung,
 * Validierung, Rollback und Audit – die reine Logik liegt in `@speakcore/shared`.
 */

/** Systemmodus (bestimmt strengere Validierungsregeln). */
export type ProvisionMode = 'simple' | 'expert';

/**
 * Internes Aktionsmodell für spätere Agent-Aktionen. Der Agent ist **kein** allgemeines
 * Docker-Admin-Interface – nur genau diese eng begrenzten Aktionen sind vorgesehen.
 * In Step 010 sind nur die Planungs-/Validierungsanteile implementiert.
 */
export type AgentActionType =
  | 'PLAN_TS3_PROVISION'
  | 'VALIDATE_TS3_PROVISION'
  | 'CREATE_MANAGED_NETWORK'
  | 'CREATE_MANAGED_VOLUME'
  | 'CREATE_TS3_CONTAINER'
  | 'START_MANAGED_CONTAINER'
  | 'STOP_MANAGED_CONTAINER'
  | 'REMOVE_MANAGED_CONTAINER'
  | 'ROLLBACK_TS3_PROVISION';

/** Erlaubte Restart-Policies. */
export type RestartPolicy = 'no' | 'on-failure' | 'unless-stopped' | 'always';

/** Optionale Ressourcen-Limits (Planung; noch keine Durchsetzung). */
export interface ResourceLimits {
  /** CPU-Anteile (z. B. 1.0 = 1 Kern). */
  cpus?: number;
  /** Speicherlimit in MB. */
  memoryMb?: number;
}

/**
 * Eingabe für die TS3-Provisionierungsplanung.
 *
 * Die mit „VERBOTEN" markierten Felder existieren nur, um die Verbote **explizit ablehnbar** zu
 * machen (Tests/Defense-in-Depth). Sie werden von der Planung NIE übernommen und von der Validierung
 * IMMER abgelehnt.
 */
export interface Ts3ProvisionInput {
  instanceId: string;
  displayName: string;
  voicePort: number;
  queryPort: number;
  fileTransferPort: number;
  /** Managed-Volume-**Name** (kein Pfad!). Optional – sonst aus instanceId abgeleitet. */
  dataVolumeName?: string;
  imageName: string;
  restartPolicy: RestartPolicy;
  mode: ProvisionMode;
  /** Nicht-geheime Umgebungsvariablen (Secrets werden separat generiert). */
  environment?: Record<string, string>;
  resourceLimits?: ResourceLimits;

  // --- VERBOTEN (immer abgelehnt) -----------------------------------------
  privileged?: boolean;
  mountDockerSocket?: boolean;
  hostMounts?: string[];
  dockerArgs?: string[];
}

export type ManagedLabels = Record<string, string>;

export interface PlannedPort {
  name: 'voice' | 'query' | 'fileTransfer';
  hostPort: number;
  containerPort: number;
  protocol: 'tcp' | 'udp';
}

export interface PlannedVolume {
  name: string;
  mountPath: string;
  labels: ManagedLabels;
}

export interface PlannedNetwork {
  name: string;
  labels: ManagedLabels;
}

export interface PlannedContainer {
  name: string;
  image: string;
  restartPolicy: RestartPolicy;
  labels: ManagedLabels;
  ports: PlannedPort[];
  volumes: Array<{ volume: string; mountPath: string }>;
  networks: string[];
  environment: Record<string, string>;
  resourceLimits?: ResourceLimits;
}

/** Geplantes Secret (nur Anforderung/Meta – NIEMALS Werte). */
export interface SecretRequirement {
  /** Logischer Name, z. B. `TS3_SERVERQUERY_ADMIN_PASSWORD`. */
  key: string;
  generate: boolean;
  /** Wo/wie das Secret abgelegt/übergeben wird. */
  storage: 'encrypted-db' | 'env-file';
  descriptionKey: string;
}

export interface RollbackStep {
  /** Wenn diese Aktion fehlschlägt … */
  onFailureOf: AgentActionType;
  /** … wird diese Aktion ausgeführt. */
  action: AgentActionType;
  /** Volume-Behandlung bei Rollback. */
  volumePolicy?: 'keep' | 'remove';
  noteKey: string;
}

export interface PlannedAuditAction {
  action: string;
  noteKey: string;
}

export interface ProvisionWarning {
  code: string;
}

export interface ValidationError {
  code: string;
  field?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
  warnings: ProvisionWarning[];
}

export interface Ts3ProvisioningPlan {
  instanceId: string;
  labels: ManagedLabels;
  container: PlannedContainer;
  volumes: PlannedVolume[];
  networks: PlannedNetwork[];
  ports: PlannedPort[];
  secrets: SecretRequirement[];
  warnings: ProvisionWarning[];
  rollback: RollbackStep[];
  audit: PlannedAuditAction[];
}

// --- Managed Write (NDF Step 012: nur Network/Volume, kein Container) --------

export type ManagedWriteOutcome = 'created' | 'exists' | 'conflict' | 'error';

export interface ManagedResourceResult {
  /** `container` kommt in Step 012 NICHT vor (nur network/volume). */
  kind: 'volume' | 'network';
  name: string;
  outcome: ManagedWriteOutcome;
}

/** Deklarativer Rollback-Eintrag – **keine** automatische Löschung in Step 012. */
export interface ManagedRollbackEntry {
  kind: 'volume' | 'network';
  name: string;
  noteKey: string;
}

export type ProvisionPrepareStatus =
  | 'ok'
  | 'partial'
  | 'conflict'
  | 'writeDisabled'
  | 'invalid'
  | 'unavailable';

/** Ergebnis der Vorbereitung (Network/Volume). Enthält NIE Secrets. */
export interface ProvisionPrepareResult {
  status: ProvisionPrepareStatus;
  resources: ManagedResourceResult[];
  errors?: ValidationError[];
  rollbackPlan: ManagedRollbackEntry[];
  audit: PlannedAuditAction[];
}

// --- Managed Container Create (NDF Step 017: `docker create`, KEIN Start) -----

export type ContainerCreateStatus =
  | 'created'
  | 'exists'
  | 'conflict'
  | 'error'
  | 'writeDisabled'
  | 'invalid'
  | 'unavailable';

/**
 * Agent-Request zum **Erstellen** (nicht Starten) eines managed TS3-Containers.
 *
 * `queryAdminPassword` ist ein **Secret**: wird ausschließlich serverseitig übergeben, vom Agent als
 * Container-**ENV** gesetzt und NIE geloggt, geplant oder im Ergebnis zurückgegeben.
 */
export interface Ts3ContainerCreateRequest {
  input: Ts3ProvisionInput;
  queryAdminUsername: string;
  queryAdminPassword: string;
}

/** Ergebnis von `docker create` (managed). Enthält NIE Secrets/ENV-Werte/Roh-Docker-Ausgabe. */
export interface ContainerCreateResult {
  status: ContainerCreateStatus;
  containerName?: string;
  errors?: ValidationError[];
  audit: PlannedAuditAction[];
}

// --- Managed Container Start (NDF Step 018: `docker start`, KEIN run/create) --

export type ContainerStartStatus =
  | 'started'
  | 'running'
  | 'notFound'
  | 'conflict'
  | 'error'
  | 'writeDisabled'
  | 'invalid'
  | 'unavailable';

/**
 * Agent-Request zum **Starten** eines bereits erstellten managed TS3-Containers.
 *
 * `licenseAccepted` muss explizit `true` sein (Nutzer hat die TS3-Lizenzbedingungen bestätigt) –
 * sonst wird nicht gestartet. Es werden keine Secrets übergeben; der Start nutzt nur die `instanceId`.
 */
export interface Ts3ContainerStartRequest {
  instanceId: string;
  licenseAccepted: boolean;
}

/** Ergebnis von `docker start` (managed). Enthält NIE Secrets/ENV-Werte/Roh-Docker-Ausgabe. */
export interface ContainerStartResult {
  status: ContainerStartStatus;
  containerName?: string;
  errors?: ValidationError[];
  audit: PlannedAuditAction[];
}

// --- Managed Container Read-only Status (NDF Step 019: nur `container ls`) ------

export type ContainerRuntimeStatus =
  | 'running'
  | 'created'
  | 'exited'
  | 'notFound'
  | 'conflict'
  | 'unavailable'
  | 'error';

/** Read-only Statusabfrage eines managed Containers. Nur `instanceId` (Name wird intern abgeleitet). */
export interface Ts3ContainerStatusRequest {
  instanceId: string;
}

/**
 * Ergebnis der read-only Laufzeit-Statusabfrage. Enthält **keine** fremden Containerdetails,
 * keine Roh-Docker-Ausgabe und keine Secrets – nur der normalisierte Zustand.
 */
export interface ContainerStatusResult {
  status: ContainerRuntimeStatus;
  containerName?: string;
}

// --- Managed Container Stop (NDF Step 021: `docker stop`, KEIN rm/restart) -----

export type ContainerStopStatus =
  | 'stopped'
  | 'alreadyStopped'
  | 'notFound'
  | 'conflict'
  | 'error'
  | 'writeDisabled'
  | 'invalid'
  | 'unavailable';

/** Agent-Request zum **Stoppen** eines managed Containers. Nur `instanceId` (Name intern abgeleitet). */
export interface Ts3ContainerStopRequest {
  instanceId: string;
}

/** Ergebnis von `docker stop` (managed). Enthält NIE Secrets/ENV-Werte/Roh-Docker-Ausgabe. */
export interface ContainerStopResult {
  status: ContainerStopStatus;
  containerName?: string;
  errors?: ValidationError[];
  audit: PlannedAuditAction[];
}

// --- Managed Container Remove (NDF Step 022: `docker rm`, KEIN -f/-v, kein Volume/Network) ----

export type ContainerRemoveStatus =
  | 'removed'
  | 'alreadyRemoved'
  | 'stillRunning'
  | 'conflict'
  | 'error'
  | 'writeDisabled'
  | 'invalid'
  | 'unavailable';

/** Agent-Request zum **Entfernen** eines gestoppten managed Containers. Nur `instanceId`. */
export interface Ts3ContainerRemoveRequest {
  instanceId: string;
}

/** Ergebnis von `docker rm` (managed). Enthält NIE Secrets/ENV-Werte/Roh-Docker-Ausgabe. */
export interface ContainerRemoveResult {
  status: ContainerRemoveStatus;
  containerName?: string;
  errors?: ValidationError[];
  audit: PlannedAuditAction[];
}

// --- Managed Volume Remove (NDF Step 025: `docker volume rm`, KEIN -f, Datenverlust!) --------

export type VolumeRemoveStatus =
  | 'removed'
  | 'alreadyRemoved'
  | 'containerStillExists'
  | 'conflict'
  | 'error'
  | 'writeDisabled'
  | 'invalid'
  | 'unavailable';

/** Agent-Request zum **Entfernen** des managed Datenvolumes. Nur `instanceId` (Name intern abgeleitet). */
export interface Ts3VolumeRemoveRequest {
  instanceId: string;
}

/** Ergebnis von `docker volume rm` (managed). Enthält NIE Secrets/Roh-Docker-Ausgabe. */
export interface VolumeRemoveResult {
  status: VolumeRemoveStatus;
  volumeName?: string;
  errors?: ValidationError[];
  audit: PlannedAuditAction[];
}

// --- Managed Network Remove (NDF Step 026: `docker network rm`, KEIN -f; shared voice-network) ---

export type NetworkRemoveStatus =
  | 'removed'
  | 'alreadyRemoved'
  | 'inUseByManagedContainers'
  | 'conflict'
  | 'error'
  | 'writeDisabled'
  | 'unavailable';

/** Ergebnis von `docker network rm` (managed voice-network). Enthält NIE Secrets/Roh-Docker-Ausgabe. */
export interface NetworkRemoveResult {
  status: NetworkRemoveStatus;
  networkName?: string;
  audit: PlannedAuditAction[];
}

// --- Managed Volume Backup (NDF Step 032: echter `docker run --rm ... tar`, read-only Quelle) -

export type VolumeBackupStatus =
  | 'created'
  | 'blocked'
  | 'containerStillExists'
  | 'volumeNotFound'
  | 'volumeNotManaged'
  | 'backupDirUnavailable'
  | 'imageUnavailable'
  | 'error'
  | 'writeDisabled'
  | 'invalid'
  | 'unavailable';

/**
 * Agent-Request für ein echtes Volume-Backup. Enthält nur `instanceId` + Bestätigungen (kein Pfad,
 * kein Image, keine freien Docker-Args vom Client). `serverDisplayName` nur für die Metadaten.
 */
export interface Ts3VolumeBackupRequest {
  instanceId: string;
  serverDisplayName?: string;
  confirmBackupMayContainSensitiveData?: boolean;
  confirmBackupStorageResponsibility?: boolean;
  confirmContainerShouldBeStopped?: boolean;
  typedConfirmation?: string;
}

/** Ergebnis des Backups. Enthält **nur** den Dateinamen (kein Host-Pfad), keine Secrets/Roh-Ausgabe. */
export interface VolumeBackupResult {
  status: VolumeBackupStatus;
  backupFileName?: string;
  /** SHA-256 der erzeugten Datei (kein Secret; Integrität, keine Verschlüsselung). Seit Step 034. */
  checksumSha256?: string;
  errors?: ValidationError[];
  audit: PlannedAuditAction[];
}

// --- Read-only Backup-Liste (NDF Step 033: NUR Sichtbarkeit, kein Download/Restore/Delete) ---

export type BackupListStatus = 'ok' | 'backupDirUnavailable' | 'invalid' | 'unavailable' | 'error';

/** Zustand der zugehörigen `.metadata.json` eines gelisteten Backups. */
export type BackupMetadataStatus = 'present' | 'missing' | 'invalid';

/** Read-only Listen-Request: NUR die `instanceId` – kein Pfad, kein Muster, keine freien Parameter. */
export interface Ts3BackupListRequest {
  instanceId: string;
}

/**
 * Ein gelistetes Backup: **nur Dateiname** (kein Host-Pfad), Größe, Zeitstempel und – falls gültig –
 * die **sanitisierten** Metadaten (nur bekannte Felder, keine Secrets, keine Roh-Dumps).
 */
export interface BackupListEntry {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  modifiedAt: string;
  metadataStatus: BackupMetadataStatus;
  metadata?: BackupMetadata;
}

/** Ergebnis der read-only Backup-Liste. Keine Host-Pfade, keine Secrets, keine Roh-Datei-Dumps. */
export interface BackupListResult {
  status: BackupListStatus;
  backups?: BackupListEntry[];
  errors?: ValidationError[];
}

// --- Read-only Backup-Verify (NDF Step 035: SHA-256 neu berechnen + vergleichen, NICHTS ändern) ---

export type BackupVerifyStatus =
  | 'valid'
  | 'mismatch'
  | 'metadataMissing'
  | 'checksumMissing'
  | 'backupNotFound'
  | 'metadataInvalid'
  | 'invalid'
  | 'backupDirUnavailable'
  | 'error'
  | 'unavailable';

/**
 * Read-only Verify-Request: `instanceId` + **strikt validierter** Backup-Dateiname (exaktes
 * Step-032-Muster, keine Pfade/Traversal). Die Metadaten-Datei wird intern abgeleitet.
 */
export interface Ts3BackupVerifyRequest {
  instanceId: string;
  fileName: string;
}

/**
 * Verify-Ergebnis: nur Status, Dateiname und Prüfsummenwerte (Integritätsinfo, keine Secrets) –
 * **keine** Host-Pfade, **keine** Roh-Metadaten, **kein** Dateiinhalt.
 */
export interface BackupVerifyResult {
  status: BackupVerifyStatus;
  fileName?: string;
  algorithm?: 'sha256';
  /** Neu berechnete SHA-256 der tar.gz. */
  checksumSha256?: string;
  /** Erwartete SHA-256 aus der metadata.json. */
  metadataChecksumSha256?: string;
  verifiedAt?: string;
  errors?: ValidationError[];
}

// --- Backup Delete/Rotation Blueprint (NDF Step 039: reine Planung, KEIN Löschen) ------------

/** Ist-Zustand für die Delete-Guards (vom Aufrufer ermittelt; die Guards sind rein/DB-frei). */
export interface BackupDeleteState {
  mode: string;
  instanceId: string;
  archived: boolean;
  actorRole: string;
  fileName: string;
  /** Existiert das Backup laut read-only Liste (Step 033)? */
  backupExists: boolean;
  metadataStatus: 'present' | 'missing' | 'invalid';
  checksumPresent: boolean;
  /** Verify-Zustand aus Step 035 – für Delete nur WARNUNG, kein Blocker. */
  verifyStatus: BackupDownloadVerifyState;
  sizeBytes: number | null;
  createdAt: string | null;
  /** Ist dies das letzte bekannte Backup der Instanz? (Warnung) */
  isOnlyBackup: boolean;
}

/** Explizite Bestätigungen für das spätere Einzel-Delete (kein Vorab-Default). */
export interface BackupDeleteConfirmations {
  confirmBackupDeletion?: boolean;
  confirmBackupMayBeOnlyCopy?: boolean;
  confirmNoRestoreWithoutBackup?: boolean;
  /** Getippte Bestätigung `DELETE BACKUP`. Wenn gesetzt, muss sie exakt passen. */
  typedConfirmation?: string;
}

/** Geplante (spätere) Lösch-Aktion – deklarativ, wird in 0.1 NICHT ausgeführt. */
export interface BackupDeletePlannedAction {
  action: 'DELETE_MANAGED_BACKUP';
  targetKind: 'backupFile';
  /** Die zugehörige metadata.json wird mit entfernt (exakt abgeleitet, nie per Wildcard). */
  deletesMetadataFile: true;
  wildcardsAllowed: false;
}

/** Aufbewahrungs-/Rotation-Policy (0.1: NUR Dry-Run-Konzept, kein automatisches Löschen). */
export interface BackupRotationPolicy {
  keepLastCount?: number;
  keepMinAgeDays?: number;
  deleteOlderThanDays?: number;
  protectLastVerifiedBackup: boolean;
  protectOnlyBackup: boolean;
  /** In 0.1 IMMER true – Rotation existiert nur als Plan. */
  dryRun: true;
}

/** Ergebnis der reinen Delete-Guard-/Planungslogik. Enthält KEINE Secrets/Host-Pfade. */
export interface BackupDeleteEvaluation {
  decision: 'allowed' | 'blocked';
  blockedReasons: string[];
  requiredConfirmations: string[];
  warnings: string[];
  /** Backup-Löschung ist irreversibel. */
  dataLossRisk: 'irreversible';
  plannedActions: BackupDeletePlannedAction[];
  retentionPolicy: BackupRotationPolicy | null;
  auditEvents: string[];
  nextRecommendedStep: string | null;
  /** In 0.1 IMMER `false` – reines Konzept, kein Löschen. */
  executable: false;
}

/** Bestätigungen für spätere Bulk-Rotation (in 0.1 nie ausführbar). */
export interface BackupRotationConfirmations {
  confirmRotationPolicyReviewed?: boolean;
  confirmBulkDeletionRisk?: boolean;
  /** Getippte Bestätigung `DELETE BACKUPS`. Wenn gesetzt, muss sie exakt passen. */
  typedConfirmation?: string;
}

/** Ein bekanntes Backup als Rotations-Input (nur Name/Alter/Verify – keine Pfade/Inhalte). */
export interface BackupRotationEntry {
  fileName: string;
  createdAt: string;
  verified?: boolean;
}

/** Dry-Run-Ergebnis der Rotationsplanung. `executable` ist IMMER `false`. */
export interface BackupRotationEvaluation {
  decision: 'dryRun' | 'blocked';
  blockedReasons: string[];
  requiredConfirmations: string[];
  warnings: string[];
  /** Kandidaten, die eine spätere echte Rotation löschen WÜRDE (nur Dateinamen). */
  deleteCandidates: string[];
  /** Behaltene Backups inkl. Schutzgrund. */
  kept: Array<{ fileName: string; protectedBy: string[] }>;
  dryRun: true;
  auditEvents: string[];
  executable: false;
}

// --- Checksum-Backfill (NDF Step 038: fehlende Prüfsumme in metadata.json nachtragen) --------

export type BackupChecksumBackfillStatus =
  | 'updated'
  | 'alreadyPresent'
  | 'metadataMissing'
  | 'metadataInvalid'
  | 'backupNotFound'
  | 'invalid'
  | 'backupDirUnavailable'
  | 'error'
  | 'unavailable';

/**
 * Backfill-Request: `instanceId` + strikt validierter Dateiname + explizite Bestätigung.
 * Die `.tar.gz` wird NUR gelesen (Hash), NIE verändert; nur die `.metadata.json` wird
 * kontrolliert neu geschrieben.
 */
export interface Ts3BackupChecksumBackfillRequest {
  instanceId: string;
  fileName: string;
  confirmChecksumBackfill?: boolean;
}

/** Backfill-Ergebnis: nur Status + Dateiname – keine Host-Pfade, keine Roh-Metadaten. */
export interface BackupChecksumBackfillResult {
  status: BackupChecksumBackfillStatus;
  fileName?: string;
}

// --- Backup Download (NDF Step 037: Web-proxied Streaming eines verifizierten Backups) -------

/**
 * Download-Request an den Agent-Stream-Endpunkt: `instanceId` + **strikt validierter** Dateiname
 * (exaktes Step-032-Muster, nur `.tar.gz` – nie `.metadata.json`, keine Pfade/Traversal).
 */
export interface Ts3BackupDownloadRequest {
  instanceId: string;
  fileName: string;
}

// --- Backup Download Blueprint (NDF Step 036: reine Planung, KEIN Download/Streaming) --------

/** Verify-Zustand aus Step 035, wie ihn der Aufrufer für die Download-Guards ermittelt hat. */
export type BackupDownloadVerifyState = 'valid' | 'mismatch' | 'notVerified' | 'checksumMissing';

/** Ist-Zustand für die Download-Guards (vom Aufrufer ermittelt; die Guards sind rein/DB-frei). */
export interface BackupDownloadState {
  mode: string;
  instanceId: string;
  /** Archiviert? Download bleibt erlaubt (Warnung) – Backups existieren serverseitig weiter. */
  archived: boolean;
  actorRole: string;
  fileName: string;
  /** Existiert das Backup laut read-only Liste (Step 033)? */
  backupExists: boolean;
  metadataStatus: 'present' | 'missing' | 'invalid';
  checksumPresent: boolean;
  verifyStatus: BackupDownloadVerifyState;
  sizeBytes: number | null;
  /** Rein modellierter Rate-Limit-Zustand (keine DB-Operation im Blueprint). */
  rateLimited: boolean;
}

/** Explizite Bestätigungen für den späteren Download (kein Vorab-Default). */
export interface BackupDownloadConfirmations {
  confirmBackupContainsSensitiveData?: boolean;
  confirmSecureStorageResponsibility?: boolean;
  /** Getippte Bestätigung, z. B. `DOWNLOAD BACKUP`. Wenn gesetzt, muss sie exakt passen. */
  typedConfirmation?: string;
}

/** Geplantes Streaming-Zielbild – deklarativ, wird in 0.1 NICHT ausgeführt. */
export interface BackupDownloadPlannedFlow {
  /** Web-proxied Streaming (Option A): Browser → Web (OWNER) → Agent (Token) → Browser. */
  kind: 'webProxiedStreaming';
  steps: string[];
  /** Der Browser spricht den Agent NIE direkt an. */
  browserToAgentDirect: false;
  /** Kein Memory-Buffering/keine temporäre Kopie – nur Streaming. */
  bufferingAllowed: false;
}

export interface BackupDownloadRateLimitPolicy {
  scope: 'ownerAndServer';
  maxDownloadsPerHour: number;
  maxDownloadsPerDay: number;
  timeoutMs: number;
}

export interface BackupDownloadSizeLimitPolicy {
  /** Ab dieser Größe ist eine explizite Warnung/Zusatzbestätigung vorgesehen. */
  warnAtBytes: number;
  streamingRequired: true;
}

/** Ergebnis der reinen Download-Guard-/Planungslogik. Enthält KEINE Secrets/Host-Pfade. */
export interface BackupDownloadEvaluation {
  decision: 'allowed' | 'blocked';
  blockedReasons: string[];
  requiredConfirmations: string[];
  warnings: string[];
  dataSensitivity: 'sensitive';
  plannedFlow: BackupDownloadPlannedFlow;
  auditEvents: string[];
  rateLimitPolicy: BackupDownloadRateLimitPolicy;
  sizeLimitPolicy: BackupDownloadSizeLimitPolicy;
  nextRecommendedStep: string | null;
  /** In 0.1 IMMER `false` – reines Konzept, kein Download, kein Streaming. */
  executable: false;
}

// --- Managed Volume Backup Blueprint (NDF Step 030: reine Planung, KEINE Ausführung) ---------

/** Zieltyp eines (späteren) Backups – rein konzeptionell, wird NIE zu einem echten Kommando. */
export type BackupTargetType = 'local' | 'hostPath' | 'download';

/** Ist-Zustand für die Backup-Guards (vom Aufrufer ermittelt; die Guards sind rein/DB-frei). */
export interface VolumeBackupState {
  instanceId: string;
  mode: string;
  provisioningStatus: string | null;
  runState: string | null;
  serverDisplayName: string;
  managedVolumeName: string | null;
  managedVolumeState: string | null; // null = vorhanden/unbekannt | "removed"
  volume: { exists: boolean; managed: boolean };
  container: { exists: boolean; running: boolean };
}

/** Explizite Bestätigungen (kein Vorab-Default). Backup kann sensible TS3-Daten enthalten. */
export interface VolumeBackupConfirmations {
  confirmBackupMayContainSensitiveData?: boolean;
  confirmBackupStorageResponsibility?: boolean;
  confirmContainerShouldBeStopped?: boolean;
  /** Optionale getippte Bestätigung, z. B. `CREATE BACKUP`. Wenn gesetzt, muss sie exakt passen. */
  typedConfirmation?: string;
}

export interface VolumeBackupRequest {
  state: VolumeBackupState;
  confirmations: VolumeBackupConfirmations;
  requestedTargetType?: BackupTargetType;
  includeMetadataExport?: boolean;
  includeAuditExport?: boolean;
}

/**
 * SHA-256-**Integritäts**-Prüfsumme eines Backups (NDF Step 034). Reine Integritätsinformation –
 * **keine Verschlüsselung, keine Signatur/Authentizität**. Kein Secret, kein Pfad.
 */
export interface BackupChecksum {
  algorithm: 'sha256';
  /** Hex-kodierte SHA-256-Prüfsumme der tar.gz-Datei. */
  value: string;
  createdAt: string;
}

/** Metadaten, die ein späterer echter Backup **mitschreiben** würde. **Enthalten selbst KEINE Secrets.** */
export interface BackupMetadata {
  backupVersion: number;
  product: 'SpeakCore';
  kind: 'managed-ts3-volume-backup';
  createdAt: string;
  instanceId: string;
  serverDisplayName: string;
  volumeName: string;
  /** Dateiname des Backups (kein Host-Pfad). Optional – im Blueprint (Step 030) leer. */
  backupFileName?: string;
  /** SHA-256-Integritätsprüfsumme (seit Step 034; ältere Backups haben keine). */
  checksum?: BackupChecksum;
  /** Der Backup-Inhalt (TS3-Daten) KANN sensibel sein – daher `unknown`, nie „secret-free". */
  containsSecrets: 'unknown';
  createdBy: string;
  notes: string[];
}

/** Deklarative geplante Aktion – **wird in 0.1 NICHT ausgeführt**. Quelle wäre read-only. */
export interface VolumeBackupPlannedAction {
  action: 'BACKUP_MANAGED_VOLUME';
  targetKind: 'volume';
  managedName?: string;
  readOnlySource: true;
}

/** Ergebnis der reinen Guard-/Planungslogik. Enthält KEINE Secrets. */
export interface VolumeBackupEvaluation {
  decision: 'allowed' | 'blocked';
  blockedReasons: string[];
  requiredConfirmations: string[];
  warnings: string[];
  /** TS3-Volumedaten gelten grundsätzlich als sensibel. */
  dataSensitivity: 'sensitive';
  plannedActions: VolumeBackupPlannedAction[];
  /** Dateinamens-Muster (Vorlage) – kein realer Pfad, kein realer Zeitstempel. */
  backupFormat: string;
  backupMetadata: BackupMetadata | null;
  auditEvents: string[];
  rollbackLimitations: string[];
  nextRecommendedStep: string | null;
  /** In 0.1 IMMER `false` – reines Konzept, kein echtes Backup. */
  executable: false;
}

// --- Deprovisioning Safety Blueprint (NDF Step 024: reine Planung, KEINE Ausführung) ---------

/** Umfang einer (späteren) Deprovisioning-Aktion. */
export type DeprovisionScope = 'containerOnly' | 'volume' | 'network' | 'credentials' | 'serverRecord';

/** Ist-Zustand der managed Ressourcen (vom Aufrufer ermittelt; die Guards sind rein/DB-frei). */
export interface DeprovisionResourceState {
  instanceId: string;
  provisioningStatus: string | null;
  runState: string | null;
  container: { exists: boolean; running: boolean };
  /** `managed` = trägt SpeakCore-Labels (`speakcore.managed=true` + Projekt/instanceId). */
  volume: { exists: boolean; managed: boolean };
  network: { exists: boolean; managed: boolean; inUseByOthers: boolean };
}

/** Explizite Sicherheitsbestätigungen (kein Vorab-Default; Volume-Löschung erfordert mehrere). */
export interface DeprovisionConfirmations {
  confirmContainerRemoved?: boolean;
  confirmVolumeDataLoss?: boolean;
  confirmBackupRecommended?: boolean;
  confirmNetworkUnused?: boolean;
  confirmCredentialRemoval?: boolean;
  confirmServerRecordArchive?: boolean;
  /** Optionale getippte Bestätigung, z. B. `DELETE VOLUME`. Wenn gesetzt, muss sie exakt passen. */
  typedConfirmation?: string;
}

export interface DeprovisionRequest {
  scope: DeprovisionScope;
  state: DeprovisionResourceState;
  confirmations: DeprovisionConfirmations;
}

/** Deklarative geplante Aktion – **wird in 0.1 NICHT ausgeführt**. */
export interface DeprovisionPlannedAction {
  action:
    | 'REMOVE_MANAGED_CONTAINER'
    | 'REMOVE_MANAGED_VOLUME'
    | 'REMOVE_MANAGED_NETWORK'
    | 'ARCHIVE_SERVER_RECORD';
  targetKind: 'container' | 'volume' | 'network' | 'serverRecord';
  /** Nur der intern abgeleitete managed Name (kein freier Nutzer-Input). */
  managedName?: string;
  dataLoss: boolean;
}

/** Ergebnis der reinen Guard-/Planungslogik. Enthält KEINE Secrets/Roh-Docker-Ausgaben. */
export interface DeprovisionEvaluation {
  scope: DeprovisionScope;
  decision: 'allowed' | 'blocked';
  /** i18n-Schlüssel der Blockgründe (kein Detail/Secret). */
  blockedReasons: string[];
  /** noch offene, erforderliche Bestätigungen (i18n-Schlüssel). */
  requiredConfirmations: string[];
  warnings: string[];
  dataLossRisk: boolean;
  plannedActions: DeprovisionPlannedAction[];
  /** deklarative Rollback-Grenzen (z. B. „Volume-Löschung ist irreversibel"). */
  rollbackLimitations: string[];
  /** geplante Audit-Events (Konzept für spätere Steps). */
  auditEvents: string[];
  /** deklarativer nächster sicherer Zustand (kein persistierter Status in 0.1). */
  nextSafeState: string | null;
  /** In 0.1 IMMER `false` – reines Konzept, keine echte Löschung. */
  executable: false;
}
