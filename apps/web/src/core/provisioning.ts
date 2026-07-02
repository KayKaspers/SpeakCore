import { createTs3ProvisioningPlan, validateTs3ProvisionInput } from '@speakcore/shared';
import type { Ts3ProvisionInput } from '@speakcore/types';
import { prisma } from './db';
import { logAudit } from './audit';
import { prepareManagedResources } from '@/lib/agent-client';
import {
  buildProvisionAuditEntries,
  provisioningErrorKey,
  resolveProvisioningStatus,
  type WebPrepareResult,
} from './provisioning-helpers';

export * from './provisioning-helpers';

/**
 * Web-Service (NDF Step 014): persistiert einen **managed** ServerInstance-Record und löst die
 * Ressourcen-Vorbereitung (Network/Volume) beim Agent aus.
 *
 * Ablauf: DRAFT-Record vor dem Agent-Aufruf anlegen (jeder Versuch ist auditierbar) → Agent prepare
 * → Provisioning-State aktualisieren → Audit persistieren. **Kein Container, kein TS3-Start.**
 * Ergebnis/DB enthalten keine Secrets/Roh-Agent-Details. OWNER-only erzwingt die Server Action.
 */
export async function prepareManagedTs3Resources(
  input: Ts3ProvisionInput,
  actor: string,
  /** Bereits validierte Query-Adresse (Host) für den späteren read-only Healthcheck; `null` = keine. */
  queryHost: string | null = null,
): Promise<WebPrepareResult> {
  // Ungültige Eingabe: kein Record anlegen (kein Junk), nur auditieren.
  if (!validateTs3ProvisionInput(input).ok) {
    const result: WebPrepareResult = {
      status: 'invalid',
      resources: [],
      instanceId: input.instanceId,
    };
    for (const entry of buildProvisionAuditEntries(result, actor)) await logAudit(entry);
    return result;
  }

  const plan = createTs3ProvisioningPlan(input);

  // 1) DRAFT-Record (managed) VOR dem Agent-Aufruf.
  const server = await prisma.serverInstance.create({
    data: {
      name: input.displayName.trim() || 'Managed TS3',
      type: 'teamspeak3',
      mode: 'managed',
      instanceId: input.instanceId,
      host: queryHost,
      voicePort: input.voicePort,
      queryPort: input.queryPort,
      fileTransferPort: input.fileTransferPort,
      runState: 'unknown',
      provisioningStatus: 'DRAFT',
      lastProvisioningStep: 'PREPARE_RESOURCES',
      managedNetworkName: plan.networks[0].name,
      managedVolumeName: plan.volumes[0].name,
      managedContainerName: plan.container.name,
    },
  });

  // Query-Adresse (Host) für den read-only Healthcheck festgehalten (keine Secrets, kein Docker-Detail).
  if (queryHost) {
    await logAudit({ action: 'managed.queryAddress.set', actor, target: server.id });
  }

  // 2) Agent prepare (Network/Volume).
  const agent = await prepareManagedResources(input);
  const status: WebPrepareResult['status'] = agent ? agent.status : 'unreachable';
  const resources = agent?.resources ?? [];

  // 3) Provisioning-State aktualisieren (kein irreführender „fertiger" Server bei writeDisabled/unavailable).
  const provisioningStatus = resolveProvisioningStatus(status);
  const prepared = status === 'ok' || status === 'partial';
  await prisma.serverInstance.update({
    where: { id: server.id },
    data: {
      provisioningStatus,
      lastProvisioningErrorKey: provisioningErrorKey(status),
      ...(prepared ? { resourcesPreparedAt: new Date() } : {}),
    },
  });

  const result: WebPrepareResult = {
    status,
    resources,
    instanceId: input.instanceId,
    serverId: server.id,
  };
  for (const entry of buildProvisionAuditEntries(result, actor)) await logAudit(entry);
  return result;
}
