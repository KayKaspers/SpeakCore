/**
 * @speakcore/types – Geteilte Typen & (spätere) API-Verträge.
 *
 * NDF Step 002: nur Typ-Stubs, KEINE Logik, KEINE fachlichen Implementierungen.
 * Diese Typen bilden die Grundlage für die spätere API zwischen WebUI, Backend und Agent.
 */

/** Unterstützte UI-Sprachen (DE/EN ab 0.1). */
export type Locale = 'de' | 'en';

/** Ampelbewertung des Preflight & Capacity Advisors. */
export type TrafficLight = 'green' | 'yellow' | 'red';

/** Erkannte/bewertete Installationsumgebung. */
export type EnvironmentType =
  | 'proxmox-vm'
  | 'proxmox-lxc'
  | 'bare-metal'
  | 'vps'
  | 'nas-home'
  | 'unknown';

/**
 * Server-Typ (Adapter-Prinzip). 0.1 implementiert ausschließlich `teamspeak3`.
 * Weitere Werte sind nur architektonisch vorgemerkt, NICHT implementiert.
 */
export type ServerType =
  | 'teamspeak3'
  // future (nicht in 0.1): 'teamspeak6' | 'mumble'
  ;

/** Laufzustand einer verwalteten Serverinstanz (Stub). */
export type ServerRunState = 'unknown' | 'stopped' | 'running' | 'error';

/** Gesundheitsstatus eines Dienstes (z. B. Agent-Health-Endpunkt). */
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  uptimeSeconds: number;
  timestamp: string;
}

/** Versions-/Metadaten eines Dienstes. */
export interface VersionInfo {
  name: string;
  version: string;
  ndfStep: string;
  commit?: string;
}

/** Generisches API-Ergebnis (Stub für spätere API-Verträge). */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

/** Audit-Log-Eintrag (bewusst minimal). */
export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  target?: string;
  result: 'success' | 'failure';
  createdAt: string;
}

// Generischer Server-Adapter-Vertrag (Adapter-Prinzip, ADR-0008).
export * from './adapter';
