/**
 * Managed TS3-Container **erstellen** (NDF Step 017) – ausschließlich `docker create`, **kein Start**.
 *
 * STRIKT: kein `run`/`start`/`stop`/`rm`/`inspect`/`exec`/`cp`/`logs`, kein `compose`, kein Socket,
 * keine Shell, keine freien Nutzerparameter, keine Host-Mounts, kein privileged. Es wird ausschließlich
 * ein Container aus einem **validierten** Provisioning-Plan (Step 010) mit SpeakCore-Labels angelegt.
 * Idempotent (managed Container existiert bereits ⇒ `exists`); gleichnamige fremde Ressource ⇒ `conflict`.
 *
 * Das ServerQuery-Admin-Passwort wird als Container-**ENV** gesetzt (verhindert Zufallspasswort in den
 * Logs → R-14). Es wird **nie** geloggt, geplant oder im Ergebnis zurückgegeben.
 */
import {
  TS3_LICENSE_ACCEPT,
  TS3_LICENSE_ENV,
  TS3_QUERY_ADMIN_PASSWORD_ENV,
  createTs3ProvisioningPlan,
  validateTs3ProvisionInput,
} from '@speakcore/shared';
import type {
  ContainerCreateResult,
  PlannedPort,
  Ts3ContainerCreateRequest,
  Ts3ProvisioningPlan,
} from '@speakcore/types';
import type { DockerExec } from './docker-cli';

function exactNames(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter((l) => l.length > 0);
}

function labelArgs(labels: Record<string, string>): string[] {
  const args: string[] = [];
  for (const [key, value] of Object.entries(labels)) args.push('--label', `${key}=${value}`);
  return args;
}

function portArgs(ports: PlannedPort[]): string[] {
  const args: string[] = [];
  for (const p of ports) args.push('-p', `${p.hostPort}:${p.containerPort}/${p.protocol}`);
  return args;
}

function envArgs(env: Record<string, string>): string[] {
  const args: string[] = [];
  for (const [key, value] of Object.entries(env)) args.push('-e', `${key}=${value}`);
  return args;
}

/**
 * Baut die **statische** `docker create`-Argumentliste aus dem validierten Plan. Das Secret wird als
 * ENV mitgegeben (letzter ENV-Eintrag), das Image steht – wie von `docker create` verlangt – am Ende.
 * Named Volume (kein Host-Pfad), festes Netzwerk, Restart-Policy aus Allowlist, Managed-Labels.
 *
 * Die (nicht-geheime) Lizenz-ENV `TS3SERVER_LICENSE=accept` muss hier gesetzt werden, weil das Image
 * sie beim Prozessstart erwartet und der spätere Startbefehl keine ENV ergänzen kann. Sie ist beim
 * Create **inert** – der Server läuft erst nach expliziter Lizenzzustimmung beim Start (Step 018, ADR-0024).
 */
export function buildCreateArgs(plan: Ts3ProvisioningPlan, secretEnv: Record<string, string>): string[] {
  const c = plan.container;
  const volume = c.volumes[0];
  return [
    'create',
    '--name',
    c.name,
    '--network',
    c.networks[0],
    '--restart',
    c.restartPolicy,
    ...labelArgs(c.labels),
    ...portArgs(c.ports),
    '-v',
    `${volume.volume}:${volume.mountPath}`,
    ...envArgs({ [TS3_LICENSE_ENV]: TS3_LICENSE_ACCEPT, ...c.environment, ...secretEnv }),
    c.image,
  ];
}

export interface CreateContainerOptions {
  writeEnabled: boolean;
  exec: DockerExec;
}

/**
 * Erstellt den managed TS3-Container (ohne Start). Rückgabe enthält **nie** Secrets/ENV-Werte.
 */
export async function createTs3Container(
  request: Ts3ContainerCreateRequest,
  opts: CreateContainerOptions,
): Promise<ContainerCreateResult> {
  if (!opts.writeEnabled) {
    return { status: 'writeDisabled', audit: [] };
  }

  if (typeof request !== 'object' || request === null) {
    return { status: 'invalid', errors: [{ code: 'inputInvalid' }], audit: [] };
  }

  const { input, queryAdminPassword } = request;

  const validation = validateTs3ProvisionInput(input);
  if (!validation.ok) {
    return { status: 'invalid', errors: validation.errors, audit: [] };
  }
  if (typeof queryAdminPassword !== 'string' || queryAdminPassword.length === 0) {
    return { status: 'invalid', errors: [{ code: 'secretMissing' }], audit: [] };
  }

  const plan = createTs3ProvisioningPlan(input);
  const name = plan.container.name;

  // Availability-Probe (nur managed gefiltert – enumeriert keine fremden Container).
  const probe = await opts.exec([
    'container',
    'ls',
    '--all',
    '--filter',
    'label=speakcore.managed=true',
    '--format',
    '{{.Names}}',
  ]);
  if (!probe.ok) {
    return { status: 'unavailable', audit: [] };
  }

  // Existiert der Container bereits als SpeakCore-managed? → idempotent, kein Create.
  const managed = await opts.exec([
    'container',
    'ls',
    '--all',
    '--filter',
    `name=${name}`,
    '--filter',
    'label=speakcore.managed=true',
    '--format',
    '{{.Names}}',
  ]);
  if (managed.ok && exactNames(managed.stdout).includes(name)) {
    return {
      status: 'exists',
      containerName: name,
      audit: [{ action: 'docker.container.exists', noteKey: 'provisioning.audit.container.exists' }],
    };
  }

  // Gleichnamiger, NICHT verwalteter Container? → Konflikt (nicht anfassen, nicht übernehmen).
  const any = await opts.exec([
    'container',
    'ls',
    '--all',
    '--filter',
    `name=${name}`,
    '--format',
    '{{.Names}}',
  ]);
  if (any.ok && exactNames(any.stdout).includes(name)) {
    return {
      status: 'conflict',
      audit: [{ action: 'docker.container.conflict', noteKey: 'provisioning.audit.container.conflict' }],
    };
  }

  // Container ERSTELLEN (nicht starten). Secret nur als ENV, nie im Audit/Ergebnis.
  const secretEnv = { [TS3_QUERY_ADMIN_PASSWORD_ENV]: queryAdminPassword };
  const created = await opts.exec(buildCreateArgs(plan, secretEnv));
  if (!created.ok) {
    return {
      status: 'error',
      audit: [{ action: 'docker.container.error', noteKey: 'provisioning.audit.container.error' }],
    };
  }

  return {
    status: 'created',
    containerName: name,
    audit: [{ action: 'docker.container.created', noteKey: 'provisioning.audit.container.created' }],
  };
}
