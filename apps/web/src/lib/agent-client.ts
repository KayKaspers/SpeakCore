import 'server-only';
import type {
  ContainerCreateResult,
  ContainerRemoveResult,
  ContainerStartResult,
  ContainerStatusResult,
  ContainerStopResult,
  DockerInventory,
  NetworkRemoveResult,
  ProvisionPrepareResult,
  SystemInfo,
  Ts3ContainerCreateRequest,
  Ts3ContainerRemoveRequest,
  Ts3ContainerStartRequest,
  Ts3ContainerStatusRequest,
  Ts3ContainerStopRequest,
  Ts3ProvisionInput,
  Ts3VolumeBackupRequest,
  Ts3VolumeRemoveRequest,
  VolumeBackupResult,
  VolumeRemoveResult,
} from '@speakcore/types';

export type AgentSnapshotResult =
  | { status: 'connected'; info: SystemInfo }
  | { status: 'unreachable' };

function agentHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = process.env.AGENT_BOOTSTRAP_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Ruft den read-only System-Snapshot des Agents ab – **ausschließlich serverseitig**.
 * Der Browser spricht den Agent nie direkt an. Agent-URL/Token kommen aus der Umgebung
 * (kein Secret gelangt in den Client). Robust gegen Nichterreichbarkeit (Timeout → Fallback).
 */
export async function fetchAgentSnapshot(timeoutMs = 2000): Promise<AgentSnapshotResult> {
  const base = process.env.AGENT_URL;
  if (!base) return { status: 'unreachable' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/system/snapshot`, {
      headers: agentHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return { status: 'unreachable' };
    const info = (await res.json()) as SystemInfo;
    return { status: 'connected', info };
  } catch {
    return { status: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ruft das read-only Docker-Inventar des Agents ab (nur SpeakCore-managed Ressourcen).
 * `null`, wenn der Agent nicht erreichbar ist. Enthält keine Secrets/fremden Details.
 */
export async function fetchDockerInventory(timeoutMs = 2500): Promise<DockerInventory | null> {
  const base = process.env.AGENT_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/docker/inventory`, {
      headers: agentHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as DockerInventory;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Löst beim Agent die Vorbereitung managed Ressourcen (Network/Volume) aus – **serverseitig**.
 * `null`, wenn der Agent nicht erreichbar ist. Enthält keine Secrets. Kein Container/Start.
 */
export async function prepareManagedResources(
  input: Ts3ProvisionInput,
  timeoutMs = 8000,
): Promise<ProvisionPrepareResult | null> {
  const base = process.env.AGENT_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/docker/provision/prepare`, {
      method: 'POST',
      headers: { ...agentHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ProvisionPrepareResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Löst beim Agent das **Erstellen** (nicht Starten) des managed TS3-Containers aus – **serverseitig**.
 * Der Request enthält das ServerQuery-Admin-Secret (nur Web→Agent, nie im Browser). `null`, wenn der
 * Agent nicht erreichbar ist. Die Antwort enthält **kein** Secret. Kein Start, kein Log-Lesen.
 */
export async function createManagedContainer(
  request: Ts3ContainerCreateRequest,
  timeoutMs = 8000,
): Promise<ContainerCreateResult | null> {
  const base = process.env.AGENT_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/docker/provision/create-container`, {
      method: 'POST',
      headers: { ...agentHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ContainerCreateResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Löst beim Agent das **Starten** des bereits erstellten managed TS3-Containers aus – **serverseitig**.
 * Übergibt nur `instanceId` + Lizenzzustimmung (keine Secrets). `null`, wenn der Agent nicht erreichbar
 * ist. Die Antwort enthält **kein** Secret. Kein `run`/`create`, kein Log-Lesen.
 */
export async function startManagedContainer(
  request: Ts3ContainerStartRequest,
  timeoutMs = 8000,
): Promise<ContainerStartResult | null> {
  const base = process.env.AGENT_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/docker/provision/start-container`, {
      method: 'POST',
      headers: { ...agentHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ContainerStartResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Löst beim Agent das **Entfernen** des gestoppten managed TS3-Containers aus – **serverseitig**.
 * Übergibt nur `instanceId` (keine Secrets). `null`, wenn der Agent nicht erreichbar ist.
 * Kein `-f`/`-v`, keine Volume-/Network-/Credential-Löschung, kein Log-Lesen; Antwort ohne Secret.
 */
export async function removeManagedContainer(
  request: Ts3ContainerRemoveRequest,
  timeoutMs = 10000,
): Promise<ContainerRemoveResult | null> {
  const base = process.env.AGENT_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/docker/provision/remove-container`, {
      method: 'POST',
      headers: { ...agentHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ContainerRemoveResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Löst beim Agent ein **echtes read-only Volume-Backup** aus – **serverseitig**. Backup-Datei ist
 * potenziell sensibel und landet im serverseitigen Agent-Backup-Verzeichnis. Übergibt nur `instanceId`
 * + Bestätigungen + Anzeigename (keine Secrets, kein Pfad/Image). `null`, wenn der Agent nicht erreichbar
 * ist. Antwort enthält nur den Dateinamen (kein Host-Pfad), keine Roh-Docker-Ausgabe.
 */
export async function backupManagedVolume(
  request: Ts3VolumeBackupRequest,
  timeoutMs = 305000,
): Promise<VolumeBackupResult | null> {
  const base = process.env.AGENT_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/docker/provision/backup-volume`, {
      method: 'POST',
      headers: { ...agentHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as VolumeBackupResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Löst beim Agent das **Entfernen des managed Voice-Networks** aus – **serverseitig**. Global/shared:
 * der Agent entfernt nur, wenn kein managed Container mehr existiert. `null`, wenn der Agent nicht
 * erreichbar ist. Kein Force, keine Volume-/Container-/Credential-Löschung; Antwort ohne Secret/Roh-Ausgabe.
 */
export async function removeManagedNetwork(timeoutMs = 10000): Promise<NetworkRemoveResult | null> {
  const base = process.env.AGENT_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/docker/provision/remove-network`, {
      method: 'POST',
      headers: { ...agentHeaders(), 'content-type': 'application/json' },
      body: '{}',
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as NetworkRemoveResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Löst beim Agent das **Entfernen des managed Datenvolumes** aus – **serverseitig**. **Datenverlust!**
 * Übergibt nur `instanceId` (keine Secrets). `null`, wenn der Agent nicht erreichbar ist. Kein `-f`,
 * keine Network-/Credential-/Record-Löschung, kein Log-Lesen; Antwort ohne Secret/Roh-Ausgabe.
 */
export async function removeManagedVolume(
  request: Ts3VolumeRemoveRequest,
  timeoutMs = 10000,
): Promise<VolumeRemoveResult | null> {
  const base = process.env.AGENT_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/docker/provision/remove-volume`, {
      method: 'POST',
      headers: { ...agentHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as VolumeRemoveResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Löst beim Agent das **Stoppen** des managed TS3-Containers aus – **serverseitig**.
 * Übergibt nur `instanceId` (keine Secrets). `null`, wenn der Agent nicht erreichbar ist.
 * Die Antwort enthält **kein** Secret. Kein `rm`/`restart`, kein Log-Lesen, keine Löschung.
 */
export async function stopManagedContainer(
  request: Ts3ContainerStopRequest,
  timeoutMs = 15000,
): Promise<ContainerStopResult | null> {
  const base = process.env.AGENT_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/docker/provision/stop-container`, {
      method: 'POST',
      headers: { ...agentHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ContainerStopResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ruft den **read-only** Laufzeit-Status eines managed Containers ab – **serverseitig**.
 * Übergibt nur `instanceId` (keine Secrets). `null`, wenn der Agent nicht erreichbar ist.
 * Enthält keine fremden Containerdetails/Roh-Ausgaben. Kein inspect/logs, kein Write.
 */
export async function fetchManagedContainerStatus(
  request: Ts3ContainerStatusRequest,
  timeoutMs = 4000,
): Promise<ContainerStatusResult | null> {
  const base = process.env.AGENT_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/docker/provision/container-status`, {
      method: 'POST',
      headers: { ...agentHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ContainerStatusResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
