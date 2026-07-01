import { validateTs3ProvisionInput } from '@speakcore/shared';
import type { Ts3ProvisionInput } from '@speakcore/types';
import { logAudit } from './audit';
import { prepareManagedResources } from '@/lib/agent-client';
import {
  buildProvisionAuditEntries,
  type WebPrepareResult,
} from './provisioning-helpers';

export * from './provisioning-helpers';

/**
 * Web-Service: löst die Vorbereitung managed Ressourcen beim Agent aus, persistiert normalisierte
 * Audit-Events und liefert ein UI-taugliches Ergebnis. **Kein Container, kein TS3-Start.**
 * Enthält keine Secrets/Roh-Agent-Details. Der Aufrufer (Server Action) erzwingt OWNER-only.
 */
export async function prepareManagedTs3Resources(
  input: Ts3ProvisionInput,
  actor: string,
): Promise<WebPrepareResult> {
  let result: WebPrepareResult;

  if (!validateTs3ProvisionInput(input).ok) {
    result = { status: 'invalid', resources: [], instanceId: input.instanceId };
  } else {
    const agent = await prepareManagedResources(input);
    result = agent
      ? { status: agent.status, resources: agent.resources, instanceId: input.instanceId }
      : { status: 'unreachable', resources: [], instanceId: input.instanceId };
  }

  for (const entry of buildProvisionAuditEntries(result, actor)) {
    await logAudit(entry);
  }
  return result;
}
