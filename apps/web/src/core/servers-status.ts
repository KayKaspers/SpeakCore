import type { Ts3ServerStatus } from './ts3/protocol';

/**
 * Persistierbare, nicht-sensible Status-Metadaten (kein Secret, keine Roh-Antwort).
 * Als schlichtes Objekt gehalten – von Prisma sowohl für create als auch update akzeptiert.
 */
export interface ServerStatusFields {
  runState: string;
  lastStatus: string;
  lastConnectedAt?: Date;
  lastStatusCheckedAt: Date;
  statusMessageKey: string | null;
  statusName?: string | null;
  statusVersion?: string | null;
  statusPlatform?: string | null;
  statusClientsOnline?: number | null;
  statusMaxClients?: number | null;
  statusUptimeSeconds?: number | null;
}

/**
 * Reine Abbildung eines TS3-Status auf persistierbare Felder (unit-testbar, keine Runtime-Importe).
 * Bei Nichterreichbarkeit bleibt der letzte bekannte Snapshot erhalten (nur Meta wird aktualisiert).
 */
export function statusToServerUpdate(
  status: Ts3ServerStatus,
  now: Date = new Date(),
): ServerStatusFields {
  if (status.reachable) {
    return {
      runState: 'connected',
      lastStatus: 'reachable',
      lastConnectedAt: now,
      lastStatusCheckedAt: now,
      statusMessageKey: null,
      statusName: status.name ?? null,
      statusVersion: status.version ?? null,
      statusPlatform: status.platform ?? null,
      statusClientsOnline: status.clientsOnline ?? null,
      statusMaxClients: status.maxClients ?? null,
      statusUptimeSeconds: status.uptimeSeconds ?? null,
    };
  }
  return {
    runState: 'error',
    lastStatus: 'unreachable',
    lastStatusCheckedAt: now,
    statusMessageKey: 'connectionFailed',
  };
}
