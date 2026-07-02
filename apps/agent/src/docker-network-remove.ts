/**
 * Managed **Voice-Network entfernen** (NDF Step 026) – ausschließlich `docker network rm`, sonst nichts.
 *
 * Das Voice-Network ist eine **geteilte, globale** Ressource (fester Name `speakcore-network-voice`), die
 * perspektivisch von mehreren managed Servern genutzt wird. Deshalb wird es **nur** entfernt, wenn **kein
 * einziger** SpeakCore-managed Container mehr existiert. STRIKT: **kein Force**, kein Volume-/Container-
 * Löschen, kein `run/create/start/stop/restart/inspect/exec/cp/logs`, kein `compose`, kein Socket, keine
 * Shell, keine freien Namen/Wildcards. Fehlt das Network ⇒ `alreadyRemoved`; fremdes gleichnamiges Network
 * ⇒ `conflict`; managed Container vorhanden ⇒ `inUseByManagedContainers`. Keine Secrets/Logs.
 */
import { NETWORK_NAME } from '@speakcore/shared';
import type { NetworkRemoveResult } from '@speakcore/types';
import type { DockerExec } from './docker-cli';

function exactNames(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter((l) => l.length > 0);
}

export interface NetworkRemoveOptions {
  writeEnabled: boolean;
  exec: DockerExec;
}

export async function removeTs3Network(opts: NetworkRemoveOptions): Promise<NetworkRemoveResult> {
  if (!opts.writeEnabled) {
    return { status: 'writeDisabled', audit: [] };
  }

  // Availability-Probe + „gibt es überhaupt noch managed Container?" in einem (managed gefiltert).
  const containers = await opts.exec([
    'container',
    'ls',
    '--all',
    '--filter',
    'label=speakcore.managed=true',
    '--format',
    '{{.Names}}',
  ]);
  if (!containers.ok) {
    return { status: 'unavailable', audit: [] };
  }
  // 1) Noch irgendein managed Container vorhanden? → Shared-Network nicht entfernen.
  if (exactNames(containers.stdout).length > 0) {
    return {
      status: 'inUseByManagedContainers',
      audit: [{ action: 'deprovision.networkRemove.inUse', noteKey: 'provisioning.audit.network.inUse' }],
    };
  }

  // 2)/3)/4) Managed Voice-Network vorhanden?
  const managedNet = await opts.exec([
    'network',
    'ls',
    '--filter',
    'label=speakcore.managed=true',
    '--filter',
    'label=speakcore.service=voice-network',
    '--format',
    '{{.Name}}',
  ]);
  const isManaged = managedNet.ok && exactNames(managedNet.stdout).includes(NETWORK_NAME);

  if (!isManaged) {
    // Gleichnamiges, NICHT verwaltetes Network? → Konflikt. Sonst fehlt es → idempotent.
    const any = await opts.exec(['network', 'ls', '--filter', `name=${NETWORK_NAME}`, '--format', '{{.Name}}']);
    if (any.ok && exactNames(any.stdout).includes(NETWORK_NAME)) {
      return {
        status: 'conflict',
        audit: [{ action: 'deprovision.networkRemove.conflict', noteKey: 'provisioning.audit.network.conflict' }],
      };
    }
    return {
      status: 'alreadyRemoved',
      networkName: NETWORK_NAME,
      audit: [{ action: 'deprovision.network.alreadyRemoved', noteKey: 'provisioning.audit.network.alreadyRemoved' }],
    };
  }

  // 5) ENTFERNEN (kein Force). `docker network rm <name>`.
  const removed = await opts.exec(['network', 'rm', NETWORK_NAME]);
  if (!removed.ok) {
    return {
      status: 'error',
      audit: [{ action: 'deprovision.networkRemove.failed', noteKey: 'provisioning.audit.network.error' }],
    };
  }

  return {
    status: 'removed',
    networkName: NETWORK_NAME,
    audit: [{ action: 'deprovision.network.removed', noteKey: 'provisioning.audit.network.removed' }],
  };
}
