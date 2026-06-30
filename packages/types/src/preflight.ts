/**
 * Preflight & Capacity Advisor – Typ-Verträge (NDF Step 005).
 *
 * NUR Datenstruktur. KEINE echten Hostdaten, KEINE Sonden, KEINE Logik hier.
 * Diese Typen werden später von WebUI und Agent gemeinsam genutzt.
 */
import type { EnvironmentType, TrafficLight } from './index';

/** Ampel-Schweregrad (GREEN/YELLOW/RED, vgl. {@link TrafficLight}). */
export type PreflightSeverity = TrafficLight;

/** Installationsumgebung (Alias auf {@link EnvironmentType}). */
export type InstallationEnvironment = EnvironmentType;

/** Konservative Installationsprofile (MVP-Richtwerte, keine Garantie). */
export type InstallationProfile = 'small' | 'medium' | 'large' | 'expert';

/** Bewertete Ressourcenkategorien. */
export type ResourceCategory =
  | 'cpu'
  | 'ram'
  | 'storage'
  | 'network'
  | 'docker'
  | 'dockerCompose'
  | 'os'
  | 'ports'
  | 'firewall'
  | 'ipStack'
  | 'dns'
  | 'backupStorage'
  | 'environment';

/** Vorhandensein einer Fähigkeit/eines Dienstes (z. B. Docker installiert?). */
export type CapabilityStatus = 'present' | 'absent' | 'unknown';

/** Unterstützte/Geplante Dienste. 0.1: nur `teamspeak3` produktiv. */
export type ServiceKind = 'teamspeak3' | 'teamspeak6' | 'mumble' | 'matrix' | 'jitsi';

/**
 * Momentaufnahme der Ressourcen. Alle Felder optional – fehlende Werte gelten als „unbekannt"
 * und dürfen NIE zu einer falschen Grün-Bewertung führen.
 *
 * In Step 005 werden diese Werte NICHT vom Host gemessen (das übernehmen spätere Agent-Sonden).
 */
export interface ResourceSnapshot {
  cpuCores?: number;
  ramGb?: number;
  freeStorageGb?: number;
  uploadMbps?: number;
  docker?: CapabilityStatus;
  dockerCompose?: CapabilityStatus;
  os?: string;
  openPorts?: number[];
  firewall?: CapabilityStatus;
  ipv4?: boolean;
  ipv6?: boolean;
  dns?: CapabilityStatus;
  backupStorageGb?: number;
}

/** Eingabe für die Preflight-Bewertung. */
export interface PreflightInput {
  environment: InstallationEnvironment;
  profile?: InstallationProfile;
  snapshot: ResourceSnapshot;
}

/** Einzelbefund einer Ressourcenkategorie. */
export interface PreflightFinding {
  category: ResourceCategory;
  severity: PreflightSeverity;
  /** Limitierender Faktor (true, wenn die Kategorie die Eignung einschränkt). */
  limiting?: boolean;
  /** Gemessener Wert (falls bekannt). */
  value?: number;
  /** Empfohlener Mindestwert. */
  recommended?: number;
  /** Einheit (z. B. "cores", "GB", "mbps"). */
  unit?: string;
  /** Optionaler Detail-Schlüssel für spezifische Hinweise (i18n unter `systemcheck.details`). */
  detailKey?: string;
}

/** Eignung eines Dienstes auf der bewerteten Umgebung. */
export interface ServiceSuitability {
  service: ServiceKind;
  severity: PreflightSeverity;
  /** In 0.1 produktiv installierbar? Nur `teamspeak3` = true; übrige sind Roadmap. */
  available: boolean;
}

/** Empfohlenes Upgrade (i18n-Schlüssel unter `systemcheck.upgrades`). */
export interface UpgradeRecommendation {
  key: string;
  params?: Record<string, string | number>;
}

/** Zusammenfassende Eignungs-Empfehlung. */
export interface CapacityRecommendation {
  /** Dienste, die als geeignet (green/yellow) gelten. */
  suitableServices: ServiceKind[];
  /** Dienste, die nicht empfohlen werden (red). */
  notRecommended: ServiceKind[];
}

/** Gesamtergebnis der Preflight-Bewertung. */
export interface PreflightResult {
  environment: InstallationEnvironment;
  profile?: InstallationProfile;
  overall: PreflightSeverity;
  findings: PreflightFinding[];
  limitingFactors: PreflightFinding[];
  services: ServiceSuitability[];
  recommendation: CapacityRecommendation;
  upgrades: UpgradeRecommendation[];
}
