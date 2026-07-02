/**
 * Reine Helfer für den managed Healthcheck (NDF Step 019) – unit-testbar, ohne DB/Agent/TS3.
 */
import type { ContainerRuntimeStatus } from '@speakcore/types';
import type { AuditInput } from './audit';

export type Ts3ReachabilityStatus = 'reachable' | 'unreachable' | 'unknown' | 'notConfigured';

export type ManagedHealthStatus = 'ok' | 'notFound' | 'notManaged' | 'invalidState';

export interface ManagedHealthResult {
  status: ManagedHealthStatus;
  serverId?: string;
  containerRuntimeStatus?: ContainerRuntimeStatus;
  ts3ReachabilityStatus?: Ts3ReachabilityStatus;
}

/** Nur `RUNNING` (letzter Lifecycle-Status) darf einen Healthcheck auslösen. */
export function resolveHealthcheck(provisioningStatus: string | null): 'ok' | 'invalidState' {
  return provisioningStatus === 'RUNNING' ? 'ok' : 'invalidState';
}

/** Ein Container-Laufzeitstatus, den der Agent definitiv ermitteln konnte (Healthcheck „completed"). */
export function isDefiniteRuntime(runtime: ContainerRuntimeStatus): boolean {
  return runtime !== 'unavailable' && runtime !== 'error';
}

/** Generischer i18n-Fehlerschlüssel aus dem Laufzeitstatus (kein Detail/Secret). `null` wenn läuft. */
export function healthErrorKey(runtime: ContainerRuntimeStatus): string | null {
  switch (runtime) {
    case 'running':
      return null;
    case 'created':
      return 'containerCreated';
    case 'exited':
      return 'containerNotRunning';
    case 'notFound':
      return 'notFound';
    case 'conflict':
      return 'conflict';
    case 'unavailable':
      return 'unavailable';
    default:
      return 'error';
  }
}

/** Ist-Laufzeit → grober `runState` (running/stopped/unknown). Überschreibt NICHT den Lifecycle-Status. */
export function runStateForRuntime(runtime: ContainerRuntimeStatus): 'running' | 'stopped' | 'unknown' {
  if (runtime === 'running') return 'running';
  if (runtime === 'created' || runtime === 'exited') return 'stopped';
  return 'unknown';
}

export interface ManagedHealthAuditParams {
  actor: string;
  serverId: string;
  containerRunning: boolean;
  /** `null`, wenn der TS3-Check gar nicht relevant war (Container läuft nicht ⇒ unknown). */
  ts3: 'reachable' | 'unreachable' | 'notConfigured' | null;
  outcome: 'completed' | 'failed';
}

/**
 * Audit-Events (keine Secrets, keine Roh-Docker-/TS3-Ausgabe, Target = ServerInstance-ID).
 */
export function buildManagedHealthAuditEntries(p: ManagedHealthAuditParams): AuditInput[] {
  const t = p.serverId;
  const entries: AuditInput[] = [{ action: 'healthcheck.managed.requested', actor: p.actor, target: t }];

  entries.push(
    p.containerRunning
      ? { action: 'healthcheck.container.running', actor: p.actor, target: t }
      : { action: 'healthcheck.container.notRunning', actor: p.actor, target: t },
  );

  if (p.ts3 === 'reachable') {
    entries.push({ action: 'healthcheck.ts3.reachable', actor: p.actor, target: t });
  } else if (p.ts3 === 'unreachable') {
    entries.push({ action: 'healthcheck.ts3.unreachable', actor: p.actor, target: t });
  } else if (p.ts3 === 'notConfigured') {
    entries.push({ action: 'healthcheck.ts3.notConfigured', actor: p.actor, target: t });
  }

  entries.push(
    p.outcome === 'completed'
      ? { action: 'healthcheck.managed.completed', actor: p.actor, target: t }
      : { action: 'healthcheck.managed.failed', actor: p.actor, target: t, result: 'failure' },
  );
  return entries;
}
