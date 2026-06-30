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

/** Erkannte Umgebungsart (read-only Heuristik, NDF Step 007). */
export type EnvironmentKind =
  | 'proxmox-vm'
  | 'proxmox-lxc'
  | 'vm'
  | 'container'
  | 'bare-metal'
  | 'unknown';

export interface EnvironmentDetection {
  kind: EnvironmentKind;
  /** Roh-Hinweis (z. B. `systemd-detect-virt`-Ausgabe: `kvm`, `lxc`, `none`); nicht sensibel. */
  virtualization?: string;
  /** Zuverlässige Erkennung? Sonst konservativ behandeln (nie falsche Sicherheit). */
  confident: boolean;
}

/**
 * Netzwerk-Zusammenfassung (read-only). Bewusst **ohne IP-Adressen/Interface-Namen** –
 * nur Booleans und Anzahl, um keine sensiblen Details (Screenshots) zu leaken.
 */
export interface NetworkInfo {
  hasIpv4: boolean;
  hasIpv6: boolean;
  hasExternalInterface: boolean;
  /** Anzahl nicht-interner Interfaces (KEINE Adressen/Namen). */
  externalInterfaceCount: number;
  dns: {
    configured: CapabilityStatus;
    /** Anzahl konfigurierter Resolver (nicht die Adressen). */
    serverCount?: number;
  };
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
  /** Erkannte Umgebung (read-only, Step 007). */
  environment: EnvironmentDetection;
  /** Netzwerk-Zusammenfassung (read-only, ohne IPs, Step 007). */
  network: NetworkInfo;
  /** ISO-8601 Zeitpunkt der Erhebung. */
  collectedAt: string;
}
