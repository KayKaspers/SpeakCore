import type { ResourceSnapshot, SystemInfo } from '@speakcore/types';

/**
 * Mappt die read-only Agent-Systeminfos auf den Preflight-`ResourceSnapshot` (reine Funktion).
 *
 * Wichtig: In Step 006 werden Netzwerk/Upload, Firewall, DNS, IPv4/IPv6 und Backup-Speicher
 * NICHT erhoben → sie bleiben `undefined` und führen damit zu „gelb", **nie zu falschem „grün"**.
 * `runPreflight()` bleibt reine Logik ohne Agent-Abhängigkeit.
 */
export function mapSystemInfoToResourceSnapshot(info: SystemInfo): ResourceSnapshot {
  return {
    cpuCores: info.cpuCores,
    ramGb: info.memory.totalGb,
    ...(info.dataPathStorageGb !== undefined ? { freeStorageGb: info.dataPathStorageGb } : {}),
    os: `${info.os.platform} ${info.os.release}`,
    docker: info.docker.available,
    dockerCompose: info.dockerCompose.available,
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
