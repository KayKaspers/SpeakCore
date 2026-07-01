/**
 * Validierung für spätere TS3-Provisionierungs-Inputs (reine Logik, NDF Step 010).
 * Lehnt gefährliche/ungültige Eingaben ab; führt KEINE Aktion aus.
 */
import type {
  ProvisionWarning,
  Ts3ProvisionInput,
  ValidationError,
  ValidationResult,
} from '@speakcore/types';
import { IMAGE_ALLOWLIST, RESERVED_PORTS, RESTART_POLICY_ALLOWLIST } from './constants';

const INSTANCE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{2,62}[A-Za-z0-9]$/;
const VOLUME_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/;

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/** Prüft die `instanceId` (server-seitig erzeugt; Defense-in-Depth gegen manipulierte Requests). */
export function isValidInstanceId(id: string): boolean {
  return typeof id === 'string' && INSTANCE_ID_RE.test(id);
}

/** Basis-Image-Name ohne Tag/Digest. Robust gegen fehlende Werte (untrusted Input). */
export function imageBaseName(image: string): string {
  return String(image ?? '')
    .split('@')[0]
    .split(':')[0]
    .trim()
    .toLowerCase();
}

export function isAllowedImage(image: string): boolean {
  return IMAGE_ALLOWLIST.includes(imageBaseName(image));
}

/** Volume-Angabe muss ein reiner Name sein – KEIN Pfad, kein Host-Mount. */
export function isPlainVolumeName(name: string): boolean {
  if (!VOLUME_NAME_RE.test(name)) return false;
  return !(
    name.includes('..') ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes(':')
  );
}

function hasControlChars(value: string): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function validateTs3ProvisionInput(input: Ts3ProvisionInput): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ProvisionWarning[] = [];
  const isSimple = input.mode !== 'expert';

  // --- Immer verbotene Felder (Defense-in-Depth) --------------------------
  if (input.privileged === true) errors.push({ code: 'forbiddenPrivileged' });
  if (input.mountDockerSocket === true) errors.push({ code: 'forbiddenDockerSocket' });
  if (input.hostMounts && input.hostMounts.length > 0) errors.push({ code: 'forbiddenHostMounts' });
  if (input.dockerArgs && input.dockerArgs.length > 0) errors.push({ code: 'forbiddenDockerArgs' });

  // --- Identität ----------------------------------------------------------
  if (!INSTANCE_ID_RE.test(input.instanceId)) {
    errors.push({ code: 'instanceIdInvalid', field: 'instanceId' });
  }
  const name = (input.displayName ?? '').trim();
  if (name.length < 1 || name.length > 64 || hasControlChars(input.displayName ?? '')) {
    errors.push({ code: 'displayNameInvalid', field: 'displayName' });
  }

  // --- Ports --------------------------------------------------------------
  const portFields: Array<['voicePort' | 'queryPort' | 'fileTransferPort', number]> = [
    ['voicePort', input.voicePort],
    ['queryPort', input.queryPort],
    ['fileTransferPort', input.fileTransferPort],
  ];
  for (const [field, port] of portFields) {
    if (!isValidPort(port)) {
      errors.push({ code: 'portInvalid', field });
      continue;
    }
    const reserved = port < 1024 || RESERVED_PORTS.has(port);
    if (reserved) {
      if (isSimple) errors.push({ code: 'portReserved', field });
      else warnings.push({ code: 'portReservedWarning' });
    }
  }
  const validPorts = portFields.map(([, p]) => p).filter(isValidPort);
  if (new Set(validPorts).size !== validPorts.length) {
    errors.push({ code: 'portDuplicate' });
  }

  // --- Image / Restart-Policy --------------------------------------------
  if (!isAllowedImage(input.imageName)) {
    errors.push({ code: 'imageNotAllowed', field: 'imageName' });
  }
  if (!RESTART_POLICY_ALLOWLIST.includes(input.restartPolicy)) {
    errors.push({ code: 'restartPolicyNotAllowed', field: 'restartPolicy' });
  }

  // --- Volume (Name, kein Pfad/Host-Mount) --------------------------------
  if (input.dataVolumeName !== undefined && !isPlainVolumeName(input.dataVolumeName)) {
    errors.push({ code: 'volumeNameInvalid', field: 'dataVolumeName' });
  }

  return { ok: errors.length === 0, errors, warnings };
}
