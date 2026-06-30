/**
 * Agent-Systeminformationen (NDF Step 006) – Vertrag zwischen SpeakCore Agent und WebUI.
 *
 * Ausschließlich **lesende, ungefährliche** Systemdaten. KEINE Secrets, KEINE Container-/Host-
 * Steuerung, KEIN Docker-Socket. Docker/Compose werden nur über `--version` geprüft.
 */
import type { CapabilityStatus } from './index';

export interface DockerProbe {
  /** `present` nur bei erfolgreichem `--version`; sonst `unknown` (nie fälschlich `absent`). */
  available: CapabilityStatus;
  version?: string;
}

export interface SystemInfo {
  agentVersion: string;
  nodeVersion: string;
  os: {
    platform: string;
    release: string;
    type: string;
  };
  arch: string;
  cpuCores: number;
  memory: {
    totalGb: number;
    /** frei/verfügbar, falls zuverlässig ermittelbar. */
    freeGb?: number;
  };
  /** Freier Speicher am Daten-/Arbeitspfad des Agents (nicht des gesamten Hosts). */
  dataPathStorageGb?: number;
  docker: DockerProbe;
  dockerCompose: DockerProbe;
  /** ISO-8601 Zeitpunkt der Erhebung. */
  collectedAt: string;
}
