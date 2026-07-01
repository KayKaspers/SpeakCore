/**
 * Managed-Only-Konstanten für die spätere Agent-Provisionierung (NDF Step 010).
 *
 * Grundsatz: **SpeakCore verwaltet nur Ressourcen, die SpeakCore selbst erzeugt hat.**
 * Alle Container/Volumes/Netzwerke tragen eindeutige Labels und Namenspräfixe.
 */
import type { AgentActionType, ManagedLabels, RestartPolicy } from '@speakcore/types';

// --- Labels ----------------------------------------------------------------
export const LABEL_MANAGED = 'speakcore.managed';
export const LABEL_PROJECT = 'speakcore.project';
export const LABEL_INSTANCE = 'speakcore.instanceId';
export const LABEL_SERVICE = 'speakcore.service';
export const PROJECT_NAME = 'SpeakCore';

export function buildManagedLabels(instanceId: string, service: string): ManagedLabels {
  return {
    [LABEL_MANAGED]: 'true',
    [LABEL_PROJECT]: PROJECT_NAME,
    [LABEL_INSTANCE]: instanceId,
    [LABEL_SERVICE]: service,
  };
}

/** Prüft, ob Labels eine von SpeakCore verwaltete Ressource kennzeichnen (Managed-Only-Guard). */
export function isManagedResource(labels: ManagedLabels | undefined): boolean {
  return labels?.[LABEL_MANAGED] === 'true' && labels?.[LABEL_PROJECT] === PROJECT_NAME;
}

// --- Namenskonventionen ----------------------------------------------------
export const CONTAINER_PREFIX = 'speakcore-ts3-';
export const VOLUME_PREFIX = 'speakcore-volume-ts3-';
export const NETWORK_NAME = 'speakcore-network-voice';

export function containerName(instanceId: string): string {
  return `${CONTAINER_PREFIX}${instanceId}`;
}
export function defaultVolumeName(instanceId: string): string {
  return `${VOLUME_PREFIX}${instanceId}`;
}
export function networkName(): string {
  return NETWORK_NAME;
}

// --- Allowlists ------------------------------------------------------------
/** Erlaubte Container-Images (Basisname ohne Tag/Digest). Simple UND Expert Mode. */
export const IMAGE_ALLOWLIST: readonly string[] = ['teamspeak'];

export const RESTART_POLICY_ALLOWLIST: readonly RestartPolicy[] = [
  'no',
  'on-failure',
  'unless-stopped',
  'always',
];

/** Erlaubte Agent-Aktionen (der Agent ist KEIN allgemeines Docker-Admin-Interface). */
export const ALLOWED_AGENT_ACTIONS: readonly AgentActionType[] = [
  'PLAN_TS3_PROVISION',
  'VALIDATE_TS3_PROVISION',
  'CREATE_MANAGED_NETWORK',
  'CREATE_MANAGED_VOLUME',
  'CREATE_TS3_CONTAINER',
  'START_MANAGED_CONTAINER',
  'STOP_MANAGED_CONTAINER',
  'REMOVE_MANAGED_CONTAINER',
  'ROLLBACK_TS3_PROVISION',
];

/**
 * Im **Simple Mode** blockierte Ports: der privilegierte Bereich (< 1024) und SpeakCore-/Infra-Ports.
 * Im Expert Mode erzeugen diese nur eine Warnung.
 */
export const RESERVED_PORTS: ReadonlySet<number> = new Set([
  22, // SSH
  25, // SMTP
  53, // DNS
  3000, // SpeakCore Web
  4000, // SpeakCore Agent
  3306, // MySQL
  5432, // PostgreSQL
  6379, // Redis
  5900, // VNC
]);

// --- TS3-Standard-Container-Ports ------------------------------------------
export const TS3_VOICE_CONTAINER_PORT = 9987; // udp
export const TS3_QUERY_CONTAINER_PORT = 10011; // tcp
export const TS3_FILETRANSFER_CONTAINER_PORT = 30033; // tcp
export const TS3_DATA_MOUNT_PATH = '/var/ts3server';

/**
 * ENV-Name, über den das ServerQuery-Admin-Passwort **vorgegeben** wird (NDF Step 017).
 * Dadurch erzeugt das TS3-Image kein Zufallspasswort in den Container-Logs → hält R-14 geschlossen
 * (SpeakCore liest **nie** Docker-Logs). Der Wert ist ein Secret und wird nie geplant/geloggt.
 */
export const TS3_QUERY_ADMIN_PASSWORD_ENV = 'TS3SERVERQUERY_ADMIN_PASSWORD';
