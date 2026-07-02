/**
 * Reine Helfer für den managed Container-Restart (NDF Step 023) – unit-testbar, ohne DB/Agent.
 *
 * Restart ist **keine** neue Docker-Aktion: er orchestriert die bestehenden **Stop**- und **Start**-
 * Flows (`RUNNING → Stop → Start → RUNNING`). Es gibt **keinen** `restart`-Docker-Befehl.
 */
import type { AuditInput } from './audit';

export type ContainerRestartServiceStatus =
  | 'restarted'
  | 'notFound'
  | 'invalidState'
  | 'licenseRequired'
  | 'stopFailed'
  | 'startFailed';

export interface ContainerRestartServiceResult {
  status: ContainerRestartServiceStatus;
  serverId?: string;
}

/** Status-Guard: nur `RUNNING` darf neu gestartet werden (kein Reparaturverhalten bei Inkonsistenz). */
export function resolveRestart(provisioningStatus: string | null): 'ok' | 'invalidState' {
  return provisioningStatus === 'RUNNING' ? 'ok' : 'invalidState';
}

export type RestartOutcome =
  | 'invalidState'
  | 'licenseRequired'
  | 'stopFailed'
  | 'startFailed'
  | 'completed';

/**
 * Vollständige, geordnete Restart-Audit-Ereignisse für ein Ergebnis (keine Secrets, Target =
 * ServerInstance-ID). `licenseConfirmed` erscheint nur, wenn die Lizenz bestätigt wurde. Die
 * eigentlichen `docker.containerStop.*`/`docker.containerStart.*`-Events schreiben die Teil-Services.
 */
export function buildRestartAuditEntries(
  outcome: RestartOutcome,
  actor: string,
  serverId: string,
): AuditInput[] {
  const t = serverId;
  const entries: AuditInput[] = [{ action: 'docker.containerRestart.requested', actor, target: t }];

  // invalidState wird vor der Lizenzprüfung erkannt; licenseRequired = Lizenz fehlt → kein licenseConfirmed.
  if (outcome === 'invalidState' || outcome === 'licenseRequired') {
    entries.push({ action: 'docker.containerRestart.failed', actor, target: t, result: 'failure' });
    return entries;
  }

  entries.push({ action: 'docker.containerRestart.licenseConfirmed', actor, target: t });
  entries.push({ action: 'docker.containerRestart.stopStarted', actor, target: t });

  if (outcome === 'stopFailed') {
    entries.push({ action: 'docker.containerRestart.failed', actor, target: t, result: 'failure' });
    return entries;
  }

  entries.push({ action: 'docker.containerRestart.stopCompleted', actor, target: t });
  entries.push({ action: 'docker.containerRestart.startStarted', actor, target: t });

  if (outcome === 'startFailed') {
    entries.push({ action: 'docker.containerRestart.failed', actor, target: t, result: 'failure' });
    return entries;
  }

  entries.push({ action: 'docker.containerRestart.completed', actor, target: t });
  return entries;
}
