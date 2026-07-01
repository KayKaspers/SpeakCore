/**
 * Erste schreibende, eng begrenzte Docker-Aktion (NDF Step 012): **nur** managed Network + Volume.
 *
 * STRIKT: kein Container, kein TS3-Start, kein Entfernen, kein Socket, keine Shell, keine freien
 * Nutzerparameter. Es werden ausschließlich Ressourcen aus einem **validierten** Provisioning-Plan
 * (Step 010) mit SpeakCore-Labels angelegt. Idempotent; Namenskonflikt mit fremder Ressource ⇒ Fehler.
 */
import { createTs3ProvisioningPlan, validateTs3ProvisionInput } from '@speakcore/shared';
import type {
  ManagedLabels,
  ManagedResourceResult,
  ManagedRollbackEntry,
  ManagedWriteOutcome,
  PlannedAuditAction,
  ProvisionPrepareResult,
  Ts3ProvisionInput,
} from '@speakcore/types';
import type { DockerExec } from './docker-cli';

type ResourceKind = 'network' | 'volume';

function exactNames(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter((l) => l.length > 0);
}

function labelArgs(labels: ManagedLabels): string[] {
  const args: string[] = [];
  for (const [key, value] of Object.entries(labels)) {
    args.push('--label', `${key}=${value}`);
  }
  return args;
}

/** Idempotentes Anlegen einer managed Ressource. Availability wird zuvor separat geprüft. */
async function ensureManaged(
  exec: DockerExec,
  kind: ResourceKind,
  name: string,
  labels: ManagedLabels,
): Promise<ManagedWriteOutcome> {
  // Existiert die Ressource bereits als SpeakCore-managed? → idempotent ok.
  const managed = await exec([
    kind,
    'ls',
    '--filter',
    `name=${name}`,
    '--filter',
    'label=speakcore.managed=true',
    '--format',
    '{{.Name}}',
  ]);
  if (managed.ok && exactNames(managed.stdout).includes(name)) return 'exists';

  // Existiert eine gleichnamige, NICHT verwaltete Ressource? → Konflikt (nicht anfassen).
  const any = await exec([kind, 'ls', '--filter', `name=${name}`, '--format', '{{.Name}}']);
  if (any.ok && exactNames(any.stdout).includes(name)) return 'conflict';

  const created = await exec([kind, 'create', ...labelArgs(labels), name]);
  return created.ok ? 'created' : 'error';
}

export interface PrepareOptions {
  writeEnabled: boolean;
  exec: DockerExec;
}

/**
 * Legt Network + Volume für einen (validierten) Provisioning-Plan an. Kein Container/TS3.
 * Rückgabe enthält **keine** Secrets; Rollback ist rein deklarativ (keine `rm`-Ausführung).
 */
export async function prepareProvision(
  input: Ts3ProvisionInput,
  opts: PrepareOptions,
): Promise<ProvisionPrepareResult> {
  if (!opts.writeEnabled) {
    return { status: 'writeDisabled', resources: [], rollbackPlan: [], audit: [] };
  }

  if (typeof input !== 'object' || input === null) {
    return {
      status: 'invalid',
      resources: [],
      errors: [{ code: 'inputInvalid' }],
      rollbackPlan: [],
      audit: [],
    };
  }

  const validation = validateTs3ProvisionInput(input);
  if (!validation.ok) {
    return { status: 'invalid', resources: [], errors: validation.errors, rollbackPlan: [], audit: [] };
  }

  const plan = createTs3ProvisioningPlan(input);

  // Availability-Probe (nur managed gefiltert – enumeriert keine fremden Ressourcen).
  const probe = await opts.exec(['network', 'ls', '--filter', 'label=speakcore.managed=true', '--format', '{{.Name}}']);
  if (!probe.ok) {
    return { status: 'unavailable', resources: [], rollbackPlan: [], audit: [] };
  }

  const network = plan.networks[0];
  const volume = plan.volumes[0];

  const netOutcome = await ensureManaged(opts.exec, 'network', network.name, network.labels);
  const volOutcome = await ensureManaged(opts.exec, 'volume', volume.name, plan.labels);

  const resources: ManagedResourceResult[] = [
    { kind: 'network', name: network.name, outcome: netOutcome },
    { kind: 'volume', name: volume.name, outcome: volOutcome },
  ];

  const outcomes = resources.map((r) => r.outcome);
  let status: ProvisionPrepareResult['status'] = 'ok';
  if (outcomes.includes('conflict')) status = 'conflict';
  else if (outcomes.includes('error')) status = 'partial';

  // Rollback rein deklarativ: nur Ressourcen, die in DIESEM Lauf erzeugt wurden.
  const rollbackPlan: ManagedRollbackEntry[] = resources
    .filter((r) => r.outcome === 'created')
    .map((r) => ({ kind: r.kind, name: r.name, noteKey: 'provisioning.rollback.manualRemovalLater' }));

  const audit: PlannedAuditAction[] = resources.map((r) => ({
    action: `docker.${r.kind}.${r.outcome}`,
    noteKey: `provisioning.audit.${r.kind}.${r.outcome}`,
  }));

  return { status, resources, rollbackPlan, audit };
}
