/**
 * Preflight & Capacity Advisor – reine Bewertungslogik (NDF Step 005).
 *
 * KEINE Next.js-, DB-, Agent- oder Host-Abhängigkeit. Vollständig unit-testbar.
 * Grundsatz: Fehlende/unbekannte Werte führen NIE zu „grün" (eher „gelb").
 */
import type {
  CapabilityStatus,
  InstallationEnvironment,
  InstallationProfile,
  PreflightFinding,
  PreflightInput,
  PreflightResult,
  PreflightSeverity,
  ResourceCategory,
  ResourceSnapshot,
  ServiceKind,
  ServiceSuitability,
  UpgradeRecommendation,
} from '@speakcore/types';
import {
  BACKUP_STORAGE_GREEN_GB,
  BACKUP_STORAGE_YELLOW_GB,
  MINIMUM_FLOOR,
  NETWORK_UPLOAD_GREEN_MBPS,
  NETWORK_UPLOAD_YELLOW_MBPS,
  PROFILE_REQUIREMENTS,
  SERVICE_ORDER,
  SERVICE_REQUIREMENTS,
} from './profiles';

const SEVERITY_ORDER: Record<PreflightSeverity, number> = { green: 0, yellow: 1, red: 2 };

/** Liefert den schlechtesten Schweregrad (red > yellow > green). */
export function worstSeverity(severities: PreflightSeverity[]): PreflightSeverity {
  return severities.reduce<PreflightSeverity>(
    (acc, s) => (SEVERITY_ORDER[s] > SEVERITY_ORDER[acc] ? s : acc),
    'green',
  );
}

/** Bewertet einen numerischen Wert gegen Grün-/Gelb-Schwellen. Unbekannt → gelb. */
function gradeAtLeast(
  value: number | undefined,
  greenMin: number,
  yellowMin: number,
): { severity: PreflightSeverity; unknown: boolean } {
  if (value === undefined || Number.isNaN(value)) return { severity: 'yellow', unknown: true };
  if (value >= greenMin) return { severity: 'green', unknown: false };
  if (value >= yellowMin) return { severity: 'yellow', unknown: false };
  return { severity: 'red', unknown: false };
}

function numericFinding(
  category: ResourceCategory,
  value: number | undefined,
  greenMin: number,
  yellowMin: number,
  unit: string,
): PreflightFinding {
  const g = gradeAtLeast(value, greenMin, yellowMin);
  return {
    category,
    severity: g.severity,
    limiting: g.severity !== 'green',
    value,
    recommended: greenMin,
    unit,
    ...(g.unknown ? { detailKey: 'unknown' } : {}),
  };
}

export function evaluateCpu(
  snapshot: ResourceSnapshot,
  profile: InstallationProfile = 'small',
): PreflightFinding {
  return numericFinding(
    'cpu',
    snapshot.cpuCores,
    PROFILE_REQUIREMENTS[profile].cpuCores,
    MINIMUM_FLOOR.cpuCores,
    'cores',
  );
}

export function evaluateMemory(
  snapshot: ResourceSnapshot,
  profile: InstallationProfile = 'small',
): PreflightFinding {
  return numericFinding(
    'ram',
    snapshot.ramGb,
    PROFILE_REQUIREMENTS[profile].ramGb,
    MINIMUM_FLOOR.ramGb,
    'GB',
  );
}

export function evaluateStorage(
  snapshot: ResourceSnapshot,
  profile: InstallationProfile = 'small',
): PreflightFinding {
  return numericFinding(
    'storage',
    snapshot.freeStorageGb,
    PROFILE_REQUIREMENTS[profile].storageGb,
    MINIMUM_FLOOR.storageGb,
    'GB',
  );
}

export function evaluateNetwork(snapshot: ResourceSnapshot): PreflightFinding {
  return numericFinding(
    'network',
    snapshot.uploadMbps,
    NETWORK_UPLOAD_GREEN_MBPS,
    NETWORK_UPLOAD_YELLOW_MBPS,
    'mbps',
  );
}

export function evaluateBackupStorage(snapshot: ResourceSnapshot): PreflightFinding {
  return numericFinding(
    'backupStorage',
    snapshot.backupStorageGb,
    BACKUP_STORAGE_GREEN_GB,
    BACKUP_STORAGE_YELLOW_GB,
    'GB',
  );
}

/** Bewertet eine Fähigkeit (Docker, Compose, Firewall, DNS). */
export function evaluateCapability(
  category: ResourceCategory,
  status: CapabilityStatus | undefined,
  criticalIfAbsent: boolean,
): PreflightFinding {
  if (status === 'present') return { category, severity: 'green' };
  if (status === undefined || status === 'unknown') {
    return { category, severity: 'yellow', limiting: true, detailKey: 'unknown' };
  }
  // absent
  return {
    category,
    severity: criticalIfAbsent ? 'red' : 'yellow',
    limiting: true,
    detailKey: 'absent',
  };
}

/** Bewertet die IP-Erreichbarkeit (IPv4/IPv6). */
export function evaluateIpStack(snapshot: ResourceSnapshot): PreflightFinding {
  const { ipv4, ipv6 } = snapshot;
  if (ipv4 === undefined && ipv6 === undefined) {
    return { category: 'ipStack', severity: 'yellow', limiting: true, detailKey: 'unknown' };
  }
  if (ipv4) return { category: 'ipStack', severity: 'green' };
  if (ipv6) return { category: 'ipStack', severity: 'yellow', limiting: true, detailKey: 'ipv6only' };
  return { category: 'ipStack', severity: 'red', limiting: true, detailKey: 'noIp' };
}

const ENVIRONMENT_GRADING: Record<
  InstallationEnvironment,
  { severity: PreflightSeverity; detailKey: string; limiting: boolean }
> = {
  'proxmox-vm': { severity: 'green', detailKey: 'proxmoxVm', limiting: false },
  'bare-metal': { severity: 'green', detailKey: 'bareMetal', limiting: false },
  vps: { severity: 'green', detailKey: 'vps', limiting: false },
  'nas-home': { severity: 'yellow', detailKey: 'nasHome', limiting: true },
  'proxmox-lxc': { severity: 'yellow', detailKey: 'lxcExpert', limiting: true },
  unknown: { severity: 'yellow', detailKey: 'environmentUnknown', limiting: true },
};

export function evaluateEnvironment(environment: InstallationEnvironment): PreflightFinding {
  const g = ENVIRONMENT_GRADING[environment];
  return {
    category: 'environment',
    severity: g.severity,
    limiting: g.limiting,
    detailKey: g.detailKey,
  };
}

/** Eignung der gewählten Installationsprofil-Anforderungen (worst-of CPU/RAM/Storage). */
export function evaluateInstallProfile(
  snapshot: ResourceSnapshot,
  profile: InstallationProfile,
): PreflightSeverity {
  return worstSeverity([
    evaluateCpu(snapshot, profile).severity,
    evaluateMemory(snapshot, profile).severity,
    evaluateStorage(snapshot, profile).severity,
  ]);
}

function gradeService(snapshot: ResourceSnapshot, service: ServiceKind): PreflightSeverity {
  const req = SERVICE_REQUIREMENTS[service];
  // Unbekannte Kernressourcen → niemals grün.
  if (snapshot.ramGb === undefined || snapshot.cpuCores === undefined) return 'yellow';
  if (snapshot.ramGb >= req.ramGreen && snapshot.cpuCores >= req.cpuGreen) return 'green';
  if (snapshot.ramGb >= req.ramYellow) return 'yellow';
  return 'red';
}

export function evaluateServiceSuitability(snapshot: ResourceSnapshot): ServiceSuitability[] {
  return SERVICE_ORDER.map((service) => ({
    service,
    severity: gradeService(snapshot, service),
    available: SERVICE_REQUIREMENTS[service].available,
  }));
}

/** Fügt mehrere Finding-Listen zusammen. */
export function combineFindings(...groups: PreflightFinding[][]): PreflightFinding[] {
  return groups.flat();
}

/** Gesamtstatus = schlechtester Einzelbefund. */
export function calculateOverallPreflightStatus(findings: PreflightFinding[]): PreflightSeverity {
  return worstSeverity(findings.map((f) => f.severity));
}

function buildUpgrades(
  findings: PreflightFinding[],
  environment: InstallationEnvironment,
): UpgradeRecommendation[] {
  const upgrades: UpgradeRecommendation[] = [];
  const push = (key: string, params?: Record<string, string | number>) => {
    if (!upgrades.some((u) => u.key === key)) upgrades.push({ key, ...(params ? { params } : {}) });
  };

  for (const f of findings) {
    if (f.severity === 'green') continue;
    switch (f.category) {
      case 'cpu':
        push('cpu', f.recommended ? { recommended: f.recommended } : undefined);
        break;
      case 'ram':
        push('ram', f.recommended ? { recommended: f.recommended } : undefined);
        break;
      case 'storage':
        push('storage', f.recommended ? { recommended: f.recommended } : undefined);
        break;
      case 'network':
        push('network');
        break;
      case 'docker':
        if (f.detailKey === 'absent') push('enableDocker');
        break;
      case 'dockerCompose':
        if (f.detailKey === 'absent') push('enableCompose');
        break;
      case 'backupStorage':
        push('backup');
        break;
      default:
        break;
    }
  }

  if (environment === 'proxmox-lxc') push('useVm');
  return upgrades;
}

/**
 * Hauptfunktion: führt die vollständige Preflight-Bewertung durch.
 * Es werden ausschließlich die übergebenen (Dummy-/Eingabe-)Daten bewertet – KEINE Hostmessung.
 */
export function runPreflight(input: PreflightInput): PreflightResult {
  const { environment, profile, snapshot } = input;

  const findings = combineFindings(
    [evaluateEnvironment(environment)],
    [
      evaluateCpu(snapshot, profile),
      evaluateMemory(snapshot, profile),
      evaluateStorage(snapshot, profile),
    ],
    [evaluateNetwork(snapshot)],
    [
      evaluateCapability('docker', snapshot.docker, true),
      evaluateCapability('dockerCompose', snapshot.dockerCompose, true),
      evaluateCapability('firewall', snapshot.firewall, false),
      evaluateCapability('dns', snapshot.dns, false),
    ],
    [evaluateIpStack(snapshot)],
    [evaluateBackupStorage(snapshot)],
  );

  const services = evaluateServiceSuitability(snapshot);

  return {
    environment,
    profile,
    overall: calculateOverallPreflightStatus(findings),
    findings,
    limitingFactors: findings.filter((f) => f.limiting),
    services,
    recommendation: {
      suitableServices: services.filter((s) => s.severity !== 'red').map((s) => s.service),
      notRecommended: services.filter((s) => s.severity === 'red').map((s) => s.service),
    },
    upgrades: buildUpgrades(findings, environment),
  };
}
