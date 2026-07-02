/**
 * Reine Mapping-/Redaction-Helfer für den read-only Managed-Server-Export (NDF Step 029).
 *
 * **Keine Secrets, keine Credentials, keine verschlüsselten Werte, keine Roh-Prisma-Objekte.** Es wird
 * **explizit** gemappt (nur erlaubte, nicht-geheime Felder). Rein/DB-frei; kein Docker/Agent.
 */

export const EXPORT_VERSION = 1;

/** Nicht-geheime Felder eines managed Servers (strukturelle Teilmenge von `ServerInstance`). */
export interface ManagedServerExportInput {
  id: string;
  name: string;
  mode: string;
  instanceId: string | null;
  provisioningStatus: string | null;
  runState: string | null;
  host: string | null;
  queryPort: number | null;
  voicePort: number | null;
  fileTransferPort: number | null;
  managedContainerName: string | null;
  managedVolumeName: string | null;
  managedVolumeState: string | null;
  managedNetworkName: string | null;
  createdAt: Date;
  updatedAt: Date;
  resourcesPreparedAt: Date | null;
  lastProvisioningStep: string | null;
  lastProvisioningErrorKey: string | null;
  lastConnectedAt: Date | null;
  lastHealthCheckedAt: Date | null;
  lastSuccessfulHealthCheckAt: Date | null;
  lastHealthErrorKey: string | null;
  containerRuntimeStatus: string | null;
  ts3ReachabilityStatus: string | null;
  statusName: string | null;
  statusVersion: string | null;
  statusPlatform: string | null;
  statusClientsOnline: number | null;
  statusMaxClients: number | null;
  statusUptimeSeconds: number | null;
  archivedAt: Date | null;
  archiveReasonKey: string | null;
  credentialsRemovedAt: Date | null;
}

export type CredentialStatus = 'kept' | 'removed' | 'none' | 'unknown';

/** Audit-Zeile wie sie aus der DB kommt (nur nicht-geheime Metadaten). */
export interface AuditEventInput {
  action: string;
  actor: string;
  target: string | null;
  result: string;
  createdAt: Date;
}

/** Exportierte Audit-Zeile – **keine Payloads**, nur erlaubte Felder. */
export interface ExportedAuditEvent {
  action: string;
  actor: string;
  target: string | null;
  result: string;
  createdAt: string;
}

export interface ManagedServerExport {
  exportVersion: number;
  exportedAt: string;
  product: 'SpeakCore';
  kind: 'managed-server-export';
  server: {
    serverId: string;
    displayName: string;
    mode: string;
    instanceId: string | null;
    provisioningStatus: string | null;
    runState: string | null;
    host: string | null;
    queryPort: number | null;
    voicePort: number | null;
    fileTransferPort: number | null;
    managedContainerName: string | null;
    managedVolumeName: string | null;
    managedVolumeState: string | null;
    managedNetworkName: string | null;
    createdAt: string;
    updatedAt: string;
    resourcesPreparedAt: string | null;
    lastProvisioningStep: string | null;
    lastProvisioningErrorKey: string | null;
    lastConnectedAt: string | null;
    lastHealthCheckedAt: string | null;
    lastSuccessfulHealthCheckAt: string | null;
    lastHealthErrorKey: string | null;
    containerRuntimeStatus: string | null;
    ts3ReachabilityStatus: string | null;
    statusName: string | null;
    statusVersion: string | null;
    statusPlatform: string | null;
    statusClientsOnline: number | null;
    statusMaxClients: number | null;
    statusUptimeSeconds: number | null;
    archivedAt: string | null;
    archiveReasonKey: string | null;
    credentialsRemovedAt: string | null;
    /** Nur Status – **niemals** die Credential-Werte selbst. */
    credentialStatus: CredentialStatus;
  };
  auditEvents: ExportedAuditEvent[];
}

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

/** Redigiert eine Audit-Zeile für den Export: nur `action/actor/target/result/createdAt`. Keine Payloads. */
export function redactAuditEventForExport(input: AuditEventInput): ExportedAuditEvent {
  return {
    action: input.action,
    actor: input.actor,
    target: input.target ?? null,
    result: input.result,
    createdAt: new Date(input.createdAt).toISOString(),
  };
}

/**
 * Baut das versionierte, **explizit gemappte** Export-Objekt. Enthält ausschließlich nicht-geheime
 * Metadaten + optional redigierte Audit-Events. Niemals Credentials/Secrets/verschlüsselte Werte.
 */
export function buildManagedServerExport(params: {
  server: ManagedServerExportInput;
  credentialStatus: CredentialStatus;
  auditEvents: ExportedAuditEvent[];
  now?: Date;
}): ManagedServerExport {
  const s = params.server;
  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: (params.now ?? new Date()).toISOString(),
    product: 'SpeakCore',
    kind: 'managed-server-export',
    server: {
      serverId: s.id,
      displayName: s.name,
      mode: s.mode,
      instanceId: s.instanceId,
      provisioningStatus: s.provisioningStatus,
      runState: s.runState,
      host: s.host,
      queryPort: s.queryPort,
      voicePort: s.voicePort,
      fileTransferPort: s.fileTransferPort,
      managedContainerName: s.managedContainerName,
      managedVolumeName: s.managedVolumeName,
      managedVolumeState: s.managedVolumeState,
      managedNetworkName: s.managedNetworkName,
      createdAt: iso(s.createdAt) ?? '',
      updatedAt: iso(s.updatedAt) ?? '',
      resourcesPreparedAt: iso(s.resourcesPreparedAt),
      lastProvisioningStep: s.lastProvisioningStep,
      lastProvisioningErrorKey: s.lastProvisioningErrorKey,
      lastConnectedAt: iso(s.lastConnectedAt),
      lastHealthCheckedAt: iso(s.lastHealthCheckedAt),
      lastSuccessfulHealthCheckAt: iso(s.lastSuccessfulHealthCheckAt),
      lastHealthErrorKey: s.lastHealthErrorKey,
      containerRuntimeStatus: s.containerRuntimeStatus,
      ts3ReachabilityStatus: s.ts3ReachabilityStatus,
      statusName: s.statusName,
      statusVersion: s.statusVersion,
      statusPlatform: s.statusPlatform,
      statusClientsOnline: s.statusClientsOnline,
      statusMaxClients: s.statusMaxClients,
      statusUptimeSeconds: s.statusUptimeSeconds,
      archivedAt: iso(s.archivedAt),
      archiveReasonKey: s.archiveReasonKey,
      credentialsRemovedAt: iso(s.credentialsRemovedAt),
      credentialStatus: params.credentialStatus,
    },
    auditEvents: params.auditEvents,
  };
}

/** Prüft rekursiv, dass keine geheimen Schlüssel/Werte im Export stehen (Defense-in-Depth). Wirft bei Leak. */
export function assertExportContainsNoSecrets(node: unknown): void {
  const forbiddenKey = /password|secret|token|session/i;
  const encryptedValue = /^v\d+:[^:]+:[^:]+:/; // Format verschlüsselter Secrets (ADR-0018)

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (forbiddenKey.test(k)) {
          throw new Error(`export contains forbidden key: ${k}`);
        }
        walk(v);
      }
      return;
    }
    if (typeof value === 'string' && encryptedValue.test(value)) {
      throw new Error('export contains an encrypted-secret-shaped value');
    }
  };

  walk(node);
}
