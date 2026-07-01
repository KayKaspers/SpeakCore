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

export interface WebPrepareResult {
  status: WebPrepareStatus;
  resources: ManagedResourceResult[];
  instanceId: string;
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
  const target = result.instanceId;
  const entries: AuditInput[] = [{ action: 'docker.prepare.requested', actor, target }];

  switch (result.status) {
    case 'writeDisabled':
      entries.push({ action: 'docker.prepare.writeDisabled', actor, target, result: 'failure' });
      break;
    case 'unavailable':
    case 'unreachable':
      entries.push({ action: 'docker.prepare.unavailable', actor, target, result: 'failure' });
      break;
    case 'invalid':
      entries.push({ action: 'docker.prepare.invalid', actor, target, result: 'failure' });
      break;
    default: {
      for (const r of result.resources) {
        if (r.outcome === 'created' || r.outcome === 'exists') {
          entries.push({ action: `docker.${r.kind}.${r.outcome}`, actor, target });
        }
      }
      if (result.status === 'conflict') {
        entries.push({ action: 'docker.prepare.conflict', actor, target, result: 'failure' });
      }
    }
  }
  return entries;
}
