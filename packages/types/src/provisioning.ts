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
