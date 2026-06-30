import type {
  EnvironmentKind,
  InstallationEnvironment,
  ResourceSnapshot,
  SystemInfo,
} from '@speakcore/types';

/**
 * Bildet die erkannte Agent-Umgebung auf eine Preflight-`InstallationEnvironment` ab.
 * Generische VM ~ produktionstauglich (wie VM); Container ~ LXC-Hinweis (Expert);
 * Unbekanntes bleibt konservativ `unknown`.
 */
export function mapDetectedEnvironment(kind: EnvironmentKind): InstallationEnvironment {
  switch (kind) {
    case 'proxmox-vm':
      return 'proxmox-vm';
    case 'proxmox-lxc':
      return 'proxmox-lxc';
    case 'vm':
      return 'proxmox-vm';
    case 'container':
      return 'proxmox-lxc';
    case 'bare-metal':
      return 'bare-metal';
    default:
      return 'unknown';
  }
}

/**
 * Mappt die read-only Agent-Systeminfos auf den Preflight-`ResourceSnapshot` (reine Funktion).
 *
 * Step 007: IPv4/IPv6 (aus lokalen, nicht-internen Interfaces) und DNS-Konfiguration werden
 * gemappt. Netzwerk-Upload, Firewall und Backup-Speicher werden weiterhin NICHT erhoben → bleiben
 * `undefined` ⇒ „gelb", **nie falsches „grün"**. `runPreflight()` bleibt reine Logik ohne
 * Agent-Abhängigkeit. Es findet KEINE externe Erreichbarkeitsprüfung statt.
 */
export function mapSystemInfoToResourceSnapshot(info: SystemInfo): ResourceSnapshot {
  return {
    cpuCores: info.cpuCores,
    ramGb: info.memory.totalGb,
    ...(info.dataPathStorageGb !== undefined ? { freeStorageGb: info.dataPathStorageGb } : {}),
    os: `${info.os.platform} ${info.os.release}`,
    docker: info.docker.available,
    dockerCompose: info.dockerCompose.available,
    ipv4: info.network.hasIpv4,
    ipv6: info.network.hasIpv6,
    dns: info.network.dns.configured,
  };
}

/** Sind die vom Agent gelieferten Kernwerte vollständig? (sonst „Daten unvollständig"). */
export function isSnapshotComplete(snapshot: ResourceSnapshot): boolean {
  return (
    snapshot.cpuCores !== undefined &&
    snapshot.ramGb !== undefined &&
    snapshot.freeStorageGb !== undefined
  );
}
