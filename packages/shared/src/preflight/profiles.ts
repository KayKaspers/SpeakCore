/**
 * Preflight – konservative MVP-Richtwerte.
 *
 * WICHTIG: Diese Zahlen sind **konservative Empfehlungen**, KEINE Garantie. Sie dienen der
 * Orientierung und werden in späteren Steps anhand realer Erfahrungswerte verfeinert.
 */
import type { InstallationProfile, ServiceKind } from '@speakcore/types';

export interface ProfileRequirement {
  cpuCores: number;
  ramGb: number;
  storageGb: number;
}

/** Grün-Schwellen je Installationsprofil. */
export const PROFILE_REQUIREMENTS: Record<InstallationProfile, ProfileRequirement> = {
  // Small: kleine TS3-/Mumble-Setups
  small: { cpuCores: 2, ramGb: 4, storageGb: 20 },
  // Medium: normale Communities
  medium: { cpuCores: 4, ramGb: 8, storageGb: 80 },
  // Large: mehrere Serverinstanzen + Monitoring
  large: { cpuCores: 6, ramGb: 16, storageGb: 200 },
  // Expert/Enterprise: manuelle Planung, mehrere Hosts, externe DB/Backups
  expert: { cpuCores: 8, ramGb: 32, storageGb: 400 },
};

/** Absolute Untergrenze (entspricht „small"). Unterhalb davon: rot. */
export const MINIMUM_FLOOR: ProfileRequirement = { cpuCores: 2, ramGb: 4, storageGb: 20 };

/** Netzwerk-Upload-Schwellen (Mbit/s). */
export const NETWORK_UPLOAD_GREEN_MBPS = 10;
export const NETWORK_UPLOAD_YELLOW_MBPS = 5;

/** Backup-Speicher-Schwellen (GB). */
export const BACKUP_STORAGE_GREEN_GB = 20;
export const BACKUP_STORAGE_YELLOW_GB = 5;

/** Ressourcenbedarf je Dienst (RAM in GB, CPU in Kernen). */
export interface ServiceRequirement {
  ramGreen: number;
  cpuGreen: number;
  /** Untergrenze für „gelb"; darunter rot. */
  ramYellow: number;
  /** In 0.1 produktiv installierbar? Nur teamspeak3 = true. */
  available: boolean;
}

export const SERVICE_REQUIREMENTS: Record<ServiceKind, ServiceRequirement> = {
  // Leichtgewichtig
  teamspeak3: { ramGreen: 4, cpuGreen: 2, ramYellow: 2, available: true },
  mumble: { ramGreen: 4, cpuGreen: 2, ramYellow: 2, available: false },
  teamspeak6: { ramGreen: 4, cpuGreen: 2, ramYellow: 2, available: false },
  // Ressourcenhungrig
  matrix: { ramGreen: 16, cpuGreen: 4, ramYellow: 8, available: false },
  jitsi: { ramGreen: 16, cpuGreen: 4, ramYellow: 8, available: false },
};

/** Reihenfolge aller Dienste für stabile Ausgabe. */
export const SERVICE_ORDER: ServiceKind[] = [
  'teamspeak3',
  'teamspeak6',
  'mumble',
  'matrix',
  'jitsi',
];
