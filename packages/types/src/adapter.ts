/**
 * Generischer Server-Adapter-Vertrag (Adapter-Prinzip, ADR-0008).
 *
 * NDF Step 003: ausschließlich **Typ-Vertrag** zur Vorbereitung späterer Adapter
 * (TS3 zuerst, dann TS6/Mumble). KEINE Implementierung, KEINE Netzwerk-/ServerQuery-Logik.
 * 0.1 wird genau einen Adapter implementieren: `teamspeak3`.
 */
import type { ApiResult, ServerRunState, ServerType } from './index';

/** Verbindungs-/Installationskontext (Details adapterspezifisch, hier bewusst offen). */
export interface AdapterContext {
  serverType: ServerType;
  /** Logische Instanz-ID innerhalb von SpeakCore (DB-Referenz). */
  instanceId: string;
}

/** Eingabe zum Verbinden eines bereits existierenden Servers. */
export interface ConnectExistingInput {
  host: string;
  port: number;
  /** Adapterspezifische Zugangsdaten – werden NIE im Klartext persistiert. */
  credentialsRef?: string;
}

/** Eingabe zum Provisionieren (Installieren) eines neuen Servers über den Agent. */
export interface ProvisionInput {
  name: string;
  /** Adapterspezifische Optionen (z. B. Slots) – in 0.1 nicht ausmodelliert. */
  options?: Record<string, string | number | boolean>;
}

/** Aktueller Status einer verwalteten Serverinstanz. */
export interface ServerStatus {
  runState: ServerRunState;
  /** Optionale, adapterspezifische Kennzahlen (z. B. Online-Clients). */
  metrics?: Record<string, number>;
}

export interface LogQuery {
  /** Maximale Anzahl Zeilen. */
  limit?: number;
  /** Nur Einträge nach diesem Zeitpunkt (ISO-8601). */
  since?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface BackupRef {
  id: string;
  createdAt: string;
}

/**
 * Einheitliche Schnittstelle, die jeder Server-Adapter erfüllen muss.
 * Alle privilegierten Schritte (Container/Host) delegiert die Implementierung an den
 * SpeakCore Agent – der Adapter führt sie NICHT selbst aus.
 */
export interface ServerAdapter {
  readonly type: ServerType;

  connectExisting(ctx: AdapterContext, input: ConnectExistingInput): Promise<ApiResult<ServerStatus>>;
  provision(ctx: AdapterContext, input: ProvisionInput): Promise<ApiResult<ServerStatus>>;

  start(ctx: AdapterContext): Promise<ApiResult<ServerStatus>>;
  stop(ctx: AdapterContext): Promise<ApiResult<ServerStatus>>;
  restart(ctx: AdapterContext): Promise<ApiResult<ServerStatus>>;

  status(ctx: AdapterContext): Promise<ApiResult<ServerStatus>>;
  logs(ctx: AdapterContext, query?: LogQuery): Promise<ApiResult<LogEntry[]>>;

  backup(ctx: AdapterContext): Promise<ApiResult<BackupRef>>;
  restore(ctx: AdapterContext, backupId: string): Promise<ApiResult<ServerStatus>>;
}
