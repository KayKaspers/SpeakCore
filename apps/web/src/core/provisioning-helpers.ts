/**
 * Reine Helfer für den Web→Agent Prepare-Flow (NDF Step 013) – unit-testbar, ohne DB/Agent/Next.
 * Erzeugt den (sicheren) Agent-Input aus UI-Feldern und normalisierte Audit-Events (keine Secrets).
 */
import type {
  ManagedResourceResult,
  ProvisionMode,
  ProvisionPrepareStatus,
  Ts3ProvisionInput,
} from '@speakcore/types';
import type { AuditInput } from './audit';

/** Web-Status inkl. „Agent nicht erreichbar". */
export type WebPrepareStatus = ProvisionPrepareStatus | 'unreachable';

/** Persistierter Provisioning-State (Step 014). Bis hierhin nur bis RESOURCES_PREPARED erreichbar. */
export type ProvisioningStatus =
  | 'DRAFT'
  | 'RESOURCES_PREPARED'
  | 'RESOURCE_PREPARE_PARTIAL'
  | 'RESOURCE_PREPARE_FAILED'
  | 'CONTAINER_PENDING'
  | 'CONTAINER_CREATED'
  | 'RUNNING'
  | 'ERROR';

export interface WebPrepareResult {
  status: WebPrepareStatus;
  resources: ManagedResourceResult[];
  instanceId: string;
  /** ID des (ggf. angelegten) managed ServerInstance-Records. */
  serverId?: string;
}

/** Bildet den Web-Prepare-Status auf den persistenten Provisioning-State ab (rein). */
export function resolveProvisioningStatus(status: WebPrepareStatus): ProvisioningStatus {
  switch (status) {
    case 'ok':
      return 'RESOURCES_PREPARED';
    case 'partial':
      return 'RESOURCE_PREPARE_PARTIAL';
    case 'conflict':
    case 'invalid':
      return 'RESOURCE_PREPARE_FAILED';
    // writeDisabled / unavailable / unreachable sind (Umgebungs-)Zustände, kein Plan-Fehler:
    default:
      return 'DRAFT';
  }
}

/** Generischer i18n-Fehlerschlüssel für den Provisioning-State (kein Secret/Detail). */
export function provisioningErrorKey(status: WebPrepareStatus): string | null {
  switch (status) {
    case 'writeDisabled':
      return 'writeDisabled';
    case 'unavailable':
      return 'unavailable';
    case 'unreachable':
      return 'unreachable';
    case 'conflict':
      return 'conflict';
    case 'invalid':
      return 'invalid';
    default:
      return null;
  }
}

export interface ProvisionFormParams {
  instanceId: string;
  displayName: string;
  voicePort: number;
  queryPort: number;
  fileTransferPort: number;
  mode: ProvisionMode;
}

/**
 * Baut den Provisioning-Input **server-seitig** aus kontrollierten UI-Feldern.
 * Image und Restart-Policy sind **fest** – der Nutzer wählt kein Image und keine freien
 * Docker-Parameter. Verbotene Felder werden nie gesetzt.
 */
export function buildProvisionInput(params: ProvisionFormParams): Ts3ProvisionInput {
  return {
    instanceId: params.instanceId,
    displayName: params.displayName,
    voicePort: params.voicePort,
    queryPort: params.queryPort,
    fileTransferPort: params.fileTransferPort,
    imageName: 'teamspeak',
    restartPolicy: 'unless-stopped',
    mode: params.mode,
  };
}

export function isOwner(user: { role: string } | null | undefined): boolean {
  return !!user && user.role === 'OWNER';
}

/**
 * Normalisierte Audit-Events aus dem Prepare-Ergebnis (keine Secrets, keine Roh-Agent-Response).
 * Actor = Owner-E-Mail, Target = instanceId.
 */
export function buildProvisionAuditEntries(
  result: WebPrepareResult,
  actor: string,
): AuditInput[] {
  // Verknüpfung mit der ServerInstance (falls vorhanden), sonst über instanceId auffindbar.
  const target = result.serverId ?? result.instanceId;
  const entries: AuditInput[] = [{ action: 'docker.prepare.requested', actor, target }];

  for (const r of result.resources) {
    if (r.outcome === 'created' || r.outcome === 'exists' || r.outcome === 'conflict') {
      entries.push({
        action: `docker.${r.kind}.${r.outcome}`,
        actor,
        target,
        result: r.outcome === 'conflict' ? 'failure' : 'success',
      });
    }
  }

  if (result.status === 'ok' || result.status === 'partial') {
    entries.push({ action: 'docker.prepare.completed', actor, target });
  } else {
    entries.push({ action: 'docker.prepare.failed', actor, target, result: 'failure' });
  }
  return entries;
}
