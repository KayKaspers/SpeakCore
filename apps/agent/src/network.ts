import os from 'node:os';
import dns from 'node:dns';
import type { CapabilityStatus, NetworkInfo } from '@speakcore/types';

/**
 * Read-only Netzwerkdaten (NDF Step 007).
 *
 * Nur lokale, ungefährliche Informationen: `os.networkInterfaces()` und die konfigurierten
 * DNS-Resolver (`dns.getServers()` – KEIN Netzwerk-Request). Es werden **keine IP-Adressen oder
 * Interface-Namen** nach außen gegeben, nur Booleans/Anzahl. KEINE externen Erreichbarkeitstests.
 */
export function summarizeInterfaces(ifaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>): {
  hasIpv4: boolean;
  hasIpv6: boolean;
  externalInterfaceCount: number;
} {
  let hasIpv4 = false;
  let hasIpv6 = false;
  const externalNames = new Set<string>();

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.internal) continue; // Loopback etc. ignorieren
      externalNames.add(name);
      if (addr.family === 'IPv4') hasIpv4 = true;
      if (addr.family === 'IPv6') hasIpv6 = true;
    }
  }

  return { hasIpv4, hasIpv6, externalInterfaceCount: externalNames.size };
}

export function gatherNetwork(): NetworkInfo {
  const summary = summarizeInterfaces(os.networkInterfaces());

  let dnsStatus: CapabilityStatus = 'unknown';
  let serverCount: number | undefined;
  try {
    const servers = dns.getServers(); // synchron, kein Request
    serverCount = servers.length;
    dnsStatus = servers.length > 0 ? 'present' : 'unknown';
  } catch {
    dnsStatus = 'unknown';
  }

  return {
    hasIpv4: summary.hasIpv4,
    hasIpv6: summary.hasIpv6,
    hasExternalInterface: summary.externalInterfaceCount > 0,
    externalInterfaceCount: summary.externalInterfaceCount,
    dns: { configured: dnsStatus, ...(serverCount !== undefined ? { serverCount } : {}) },
  };
}
