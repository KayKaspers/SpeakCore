/**
 * Read-only Docker-Inventar (NDF Step 011).
 *
 * NUR **SpeakCore-managed** Ressourcen (Label `speakcore.managed=true`). Es werden bewusst KEINE
 * vollständigen Docker-Rohobjekte und KEINE Details fremder Ressourcen abgebildet. Der Agent liest
 * ausschließlich (kein Erstellen/Starten/Stoppen/Löschen).
 */
export type DockerResourceKind = 'container' | 'volume' | 'network';

export type DockerInventoryStatus = 'available' | 'unavailable';

/** Nur die auf SpeakCore gefilterten Labels – keine fremden Labels. */
export interface ManagedResourceLabelSet {
  managed: 'true';
  project?: string;
  instanceId?: string;
  service?: string;
}

export interface DockerManagedContainer {
  id: string;
  name: string;
  kind: 'container';
  managed: true;
  instanceId?: string;
  service?: string;
  /** Normalisierter Zustand (running/exited/…), falls verfügbar. */
  state?: string;
  labels: ManagedResourceLabelSet;
}

export interface DockerManagedVolume {
  name: string;
  kind: 'volume';
  managed: true;
  instanceId?: string;
  service?: string;
  labels: ManagedResourceLabelSet;
}

export interface DockerManagedNetwork {
  id: string;
  name: string;
  kind: 'network';
  managed: true;
  instanceId?: string;
  service?: string;
  labels: ManagedResourceLabelSet;
}

export interface DockerInventory {
  status: DockerInventoryStatus;
  containers: DockerManagedContainer[];
  volumes: DockerManagedVolume[];
  networks: DockerManagedNetwork[];
  collectedAt: string;
}
