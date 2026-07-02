/**
 * Managed Container neu starten (NDF Step 023): `RUNNING → Stop → Start → RUNNING`.
 *
 * **Kein** `restart`-Docker-Kommando und **keine** neue Docker-Schreibaktion im Agent: der Restart orchestriert
 * ausschließlich die bestehenden, geprüften **Stop**- (Step 021) und **Start**-Flows (Step 018), die
 * ihrerseits Token + `AGENT_DOCKER_WRITE_ENABLED` erzwingen und ihre eigenen `docker.container(Stop|Start).*`
 * -Audits schreiben. Kein Start, wenn Stop fehlschlägt; kein `RUNNING`, wenn Start fehlschlägt. Keine
 * Löschung, kein Log-Lesen, keine Secrets im Ergebnis. OWNER-only wird von der Server Action erzwungen.
 */
import { prisma } from './db';
import { logAudit } from './audit';
import { stopManagedContainerForServer } from './container-stop';
import { startManagedContainerForServer } from './container-start';
import {
  buildRestartAuditEntries,
  resolveRestart,
  type ContainerRestartServiceResult,
  type RestartOutcome,
} from './container-restart-helpers';

export * from './container-restart-helpers';

async function finalize(
  serverId: string,
  actor: string,
  outcome: RestartOutcome,
  errorKey: string | null,
): Promise<void> {
  await prisma.serverInstance.update({
    where: { id: serverId },
    data: { lastProvisioningStep: 'RESTART_CONTAINER', lastProvisioningErrorKey: errorKey },
  });
  for (const e of buildRestartAuditEntries(outcome, actor, serverId)) await logAudit(e);
}

export async function restartManagedContainerForServer(
  serverId: string,
  actor: string,
  licenseAccepted: boolean,
): Promise<ContainerRestartServiceResult> {
  const server = await prisma.serverInstance.findUnique({ where: { id: serverId } });
  if (!server || server.mode !== 'managed') return { status: 'notFound' };

  if (resolveRestart(server.provisioningStatus) !== 'ok') {
    for (const e of buildRestartAuditEntries('invalidState', actor, serverId)) await logAudit(e);
    return { status: 'invalidState', serverId };
  }

  // Ohne explizite Lizenzzustimmung KEIN Restart (kein licenseConfirmed-Event, Status unverändert).
  if (licenseAccepted !== true) {
    for (const e of buildRestartAuditEntries('licenseRequired', actor, serverId)) await logAudit(e);
    return { status: 'licenseRequired', serverId };
  }

  // Phase 1: bestehender Stop-Flow (setzt bei Erfolg CONTAINER_CREATED + runState='stopped').
  const stopRes = await stopManagedContainerForServer(serverId, actor);
  if (stopRes.status !== 'stopped' && stopRes.status !== 'alreadyStopped') {
    // Stop fehlgeschlagen ⇒ Start NICHT versuchen; Status bleibt (RUNNING), generischer Fehlerschlüssel.
    await finalize(serverId, actor, 'stopFailed', 'restartStopFailed');
    return { status: 'stopFailed', serverId };
  }

  // Phase 2: bestehender Start-Flow (Lizenz erneut bestätigt; setzt bei Erfolg RUNNING + runState='running').
  const startRes = await startManagedContainerForServer(serverId, actor, true);
  if (startRes.status !== 'started' && startRes.status !== 'running') {
    // Start fehlgeschlagen nach erfolgreichem Stop ⇒ bleibt CONTAINER_CREATED/runState='stopped'.
    await finalize(serverId, actor, 'startFailed', 'restartStartFailed');
    return { status: 'startFailed', serverId };
  }

  // Erfolg: Start-Flow hat bereits RUNNING + runState='running' + errorKey=null gesetzt.
  await finalize(serverId, actor, 'completed', null);
  return { status: 'restarted', serverId };
}
