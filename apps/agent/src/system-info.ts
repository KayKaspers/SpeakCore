import os from 'node:os';
import { execFile } from 'node:child_process';
import { statfs } from 'node:fs/promises';
import { APP_VERSION } from '@speakcore/shared';
import type { DockerProbe, SystemInfo } from '@speakcore/types';
import { detectEnvironment } from './environment';
import { gatherNetwork } from './network';

/**
 * Read-only Systemerhebung (NDF Step 006).
 *
 * STRIKT lesend und ungefährlich:
 * - keine Container-/Host-Steuerung, keine Container-Operationen (Listing, Inspektion, Start/Stop)
 * - kein Docker-Socket
 * - Docker/Compose nur über `--version` / `compose version` (statische Argumente)
 * - CLI-Aufrufe via execFile (KEINE Shell → keine Command-Injection) mit Timeout
 * - Fehler/Timeouts ⇒ `unknown` (kein Crash, nie fälschlich `absent`)
 */
const CLI_TIMEOUT_MS = 1500;
const GB = 1024 ** 3;

function toGb(bytes: number): number {
  return Math.round((bytes / GB) * 10) / 10;
}

/** Führt ein erlaubtes Kommando mit statischen Argumenten ohne Shell aus. */
function runVersion(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout: CLI_TIMEOUT_MS, windowsHide: true, shell: false },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        resolve(stdout.toString().trim());
      },
    );
  });
}

async function probeDocker(): Promise<DockerProbe> {
  const out = await runVersion('docker', ['--version']);
  // Nicht ermittelbar ⇒ unknown (nicht absent): der Agent kann Docker evtl. nur nicht aufrufen.
  if (!out) return { available: 'unknown' };
  return { available: 'present', version: out };
}

async function probeDockerCompose(): Promise<DockerProbe> {
  const out = await runVersion('docker', ['compose', 'version']);
  if (!out) return { available: 'unknown' };
  return { available: 'present', version: out };
}

async function probeDataPathStorageGb(): Promise<number | undefined> {
  const path = process.env.AGENT_DATA_PATH ?? process.cwd();
  try {
    const stats = await statfs(path);
    // Für unprivilegierte Prozesse verfügbarer Speicher.
    return toGb(Number(stats.bavail) * Number(stats.bsize));
  } catch {
    return undefined;
  }
}

export async function gatherSystemInfo(): Promise<SystemInfo> {
  const totalmem = os.totalmem();
  const freemem = os.freemem();

  const [docker, dockerCompose, dataPathStorageGb, environment] = await Promise.all([
    probeDocker(),
    probeDockerCompose(),
    probeDataPathStorageGb(),
    detectEnvironment(),
  ]);
  const network = gatherNetwork();

  return {
    agentVersion: APP_VERSION,
    nodeVersion: process.version,
    os: { platform: os.platform(), release: os.release(), type: os.type() },
    arch: os.arch(),
    cpuCores: os.cpus().length,
    memory: {
      totalGb: toGb(totalmem),
      ...(freemem > 0 ? { freeGb: toGb(freemem) } : {}),
    },
    ...(dataPathStorageGb !== undefined ? { dataPathStorageGb } : {}),
    docker,
    dockerCompose,
    environment,
    network,
    collectedAt: new Date().toISOString(),
  };
}
