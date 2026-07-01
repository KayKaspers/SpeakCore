/**
 * Host-/Port-Validierung für externe TS3-Verbindungen (reine Logik, NDF Step 008).
 *
 * SSRF-Hinweis: Selbstgehostete TS3-Server liegen oft in **privaten LAN-Netzen** (10.x, 192.168.x)
 * oder auf demselben Host – diese werden bewusst **zugelassen** (legitimer Self-Hosting-Fall).
 * Blockiert werden nur eindeutig missbräuchliche Ziele:
 *   - Cloud-Metadaten (`169.254.169.254`) und Link-Local `169.254.0.0/16`
 *   - `0.0.0.0` / `::` (unspezifiziert)
 * Eine strengere Egress-Beschränkung ist für einen späteren Security-Step vorgemerkt (RISKS R-13).
 */
export interface HostValidation {
  ok: boolean;
  errorKey?: 'hostRequired' | 'hostInvalid' | 'hostBlocked';
}

const BLOCKED_EXACT = new Set(['0.0.0.0', '::', '169.254.169.254']);

export function validateServerHost(host: string): HostValidation {
  const h = host.trim();
  if (!h) return { ok: false, errorKey: 'hostRequired' };
  if (h.length > 253) return { ok: false, errorKey: 'hostInvalid' };
  // Keine Schemata, Slashes, Whitespace oder eingebettete Credentials.
  if (/[\s/\\@]/.test(h) || h.includes('://')) return { ok: false, errorKey: 'hostInvalid' };

  const lower = h.toLowerCase();
  if (BLOCKED_EXACT.has(lower) || lower.startsWith('169.254.')) {
    return { ok: false, errorKey: 'hostBlocked' };
  }

  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
  if (isIpv4) {
    if (h.split('.').some((o) => Number(o) > 255)) return { ok: false, errorKey: 'hostInvalid' };
    return { ok: true };
  }

  const isIpv6 = /^[0-9a-fA-F:]+$/.test(h) && h.includes(':');
  const isHostname =
    /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
      h,
    );

  if (!isIpv6 && !isHostname) return { ok: false, errorKey: 'hostInvalid' };
  return { ok: true };
}

export function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}
