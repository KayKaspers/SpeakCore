import { execFile } from 'node:child_process';
import type { DockerInventory } from '@speakcore/types';
import { parseContainers, parseNetworks, parseVolumes } from './docker-inventory-parser';

/**
 * Read-only Docker-Inventar (NDF Step 011).
 *
 * STRIKT lesend: nur `ps` / `volume ls` / `network ls` mit `--filter label=speakcore.managed=true`
 * und statischem `--format`. execFile ohne Shell, statische Argumente, Timeout. KEINE schreibenden
 * Aktionen, kein Erstellen/Starten/Stoppen/Entfernen, kein Socket. Nicht verfügbar ⇒ `unavailable`
 * (kein Crash). Es werden ausschließlich SpeakCore-managed Ressourcen abgebildet.
 */
const CLI_TIMEOUT_MS = 2500;
const MANAGED_FILTER = 'label=speakcore.managed=true';

const CONTAINER_FORMAT = '{{.ID}}|{{.Names}}|{{.State}}|{{.Labels}}';
const VOLUME_FORMAT = '{{.Name}}|{{.Labels}}';
const NETWORK_FORMAT = '{{.ID}}|{{.Name}}|{{.Labels}}';

/** Führt ein lesendes Docker-Kommando mit statischen Argumenten aus. `null` bei Fehler/Timeout. */
function readDocker(args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('docker', args, { timeout: CLI_TIMEOUT_MS, windowsHide: true, shell: false }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      resolve(stdout.toString());
    });
  });
}

export async function gatherDockerInventory(): Promise<DockerInventory> {
  const collectedAt = new Date().toISOString();

  const containersOut = await readDocker([
    'ps',
    '--all',
    '--no-trunc',
    '--filter',
    MANAGED_FILTER,
    '--format',
    CONTAINER_FORMAT,
  ]);

  // Wenn schon die Container-Abfrage nicht möglich ist, gilt Docker als nicht verfügbar.
  if (containersOut === null) {
    return { status: 'unavailable', containers: [], volumes: [], networks: [], collectedAt };
  }

  const [volumesOut, networksOut] = await Promise.all([
    readDocker(['volume', 'ls', '--filter', MANAGED_FILTER, '--format', VOLUME_FORMAT]),
    readDocker(['network', 'ls', '--filter', MANAGED_FILTER, '--format', NETWORK_FORMAT]),
  ]);

  return {
    status: 'available',
    containers: parseContainers(containersOut),
    volumes: parseVolumes(volumesOut ?? ''),
    networks: parseNetworks(networksOut ?? ''),
    collectedAt,
  };
}
