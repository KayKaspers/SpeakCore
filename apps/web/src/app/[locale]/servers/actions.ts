'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { validatePort, validateServerHost } from '@/core/host-validation';
import { isEncryptionConfigured } from '@/core/crypto';
import { logAudit } from '@/core/audit';
import { checkRateLimit, recordRateLimitHit, type RateLimitConfig } from '@/core/rate-limit';
import {
  createExternalServer,
  refreshServerStatus,
  removeServer,
  testTs3Connection,
  type CreateExternalServerInput,
} from '@/core/servers';
import { prepareManagedContainer } from '@/core/container-prepare';
import { createManagedContainerForServer } from '@/core/container-create';
import { startManagedContainerForServer } from '@/core/container-start';
import { stopManagedContainerForServer } from '@/core/container-stop';
import { removeManagedContainerForServer } from '@/core/container-remove';
import { restartManagedContainerForServer } from '@/core/container-restart';
import { removeManagedVolumeForServer } from '@/core/volume-remove';
import { removeManagedNetworkForServer } from '@/core/network-remove';
import { backupManagedVolumeForServer } from '@/core/volume-backup';
import { verifyManagedVolumeBackupForServer } from '@/core/backup-verify';
import { archiveManagedServer, type CredentialDecision } from '@/core/server-archive';
import { runManagedHealthcheck } from '@/core/managed-health';
import { updateManagedQueryAddress } from '@/core/managed-query';

export interface AddServerState {
  errorKey?: string;
}

// Verbindungstests sind kostspielig/SSRF-relevant → moderat begrenzen.
const CONNECT_RATE_LIMIT: RateLimitConfig = { windowMs: 10 * 60 * 1000, max: 10 };

function parseOptionalInt(value: FormDataEntryValue | null): number | undefined {
  const s = String(value ?? '').trim();
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isInteger(n) ? n : Number.NaN;
}

export async function addServerAction(
  _prev: AddServerState,
  formData: FormData,
): Promise<AddServerState> {
  const locale = String(formData.get('locale') ?? 'de');

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const name = String(formData.get('name') ?? '').trim();
  const host = String(formData.get('host') ?? '').trim();
  const queryPort = parseOptionalInt(formData.get('queryPort'));
  const voicePort = parseOptionalInt(formData.get('voicePort'));
  const virtualServerId = parseOptionalInt(formData.get('virtualServerId'));
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!name) return { errorKey: 'nameRequired' };

  const hostCheck = validateServerHost(host);
  if (!hostCheck.ok) return { errorKey: hostCheck.errorKey ?? 'hostInvalid' };

  if (queryPort === undefined || Number.isNaN(queryPort) || !validatePort(queryPort)) {
    return { errorKey: 'portInvalid' };
  }
  if (voicePort !== undefined && (Number.isNaN(voicePort) || !validatePort(voicePort))) {
    return { errorKey: 'portInvalid' };
  }
  if (virtualServerId !== undefined && (Number.isNaN(virtualServerId) || virtualServerId < 1)) {
    return { errorKey: 'virtualServerInvalid' };
  }
  if (!username || !password) return { errorKey: 'credentialsRequired' };

  if (!isEncryptionConfigured()) return { errorKey: 'encryptionMissing' };

  const rlKey = `ts3:connect:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    return { errorKey: 'rateLimited' };
  }
  await recordRateLimitHit(rlKey);

  const input: CreateExternalServerInput = {
    name,
    host,
    queryPort,
    voicePort,
    virtualServerId,
    username,
    password,
  };

  // Verbindung testen (read-only). Bei Fehler generisch melden – keine Secrets/Details leaken.
  let status;
  try {
    status = await testTs3Connection(input);
  } catch {
    status = { reachable: false } as const;
  }
  if (!status.reachable) {
    await logAudit({ action: 'server.test', actor: user.email, target: host, result: 'failure' });
    return { errorKey: 'connectionFailed' };
  }
  await logAudit({ action: 'server.test', actor: user.email, target: host });

  const created = await createExternalServer(input, user.email, status);
  redirect(`/${locale}/servers/${created.id}`);
}

/** Aktualisiert den read-only Status eines Servers (OWNER-only, rate-limitiert). */
export async function refreshServerAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `ts3:connect:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  await refreshServerStatus(id, user.email);
  redirect(`/${locale}/servers/${id}`);
}

/** Entfernt einen Server inkl. Credentials (OWNER-only, Bestätigung erfolgt in der UI). */
export async function removeServerAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  await removeServer(id, user.email);
  redirect(`/${locale}/servers`);
}

/**
 * Bereitet die Container-Erstellung eines managed Servers vor (RESOURCES_PREPARED → CONTAINER_PENDING):
 * generiert + speichert ein verschlüsseltes Secret. OWNER-only. **Kein Docker-Container/Start.**
 */
export async function prepareContainerAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `container:prepare:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await prepareManagedContainer(id, user.email);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'pending' || result.status === 'alreadyPending') {
    redirect(`/${locale}/servers/${id}`);
  }
  // encryptionMissing | invalidState | invalidPlan
  redirect(`/${locale}/servers/${id}?notice=${result.status}`);
}

/**
 * Erstellt den managed TS3-Container (CONTAINER_PENDING → CONTAINER_CREATED). OWNER-only,
 * rate-limitiert. Entschlüsselt das Secret serverseitig und übergibt es dem Agent (ENV).
 * **Kein Container-Start, kein Log-Lesen, kein Secret im Client.**
 */
export async function createContainerAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `container:create:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await createManagedContainerForServer(id, user.email);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'created' || result.status === 'exists') {
    redirect(`/${locale}/servers/${id}`);
  }
  // invalidState | encryptionMissing | credentialMissing | invalidPlan
  //   | writeDisabled | unavailable | unreachable | conflict | error
  redirect(`/${locale}/servers/${id}?notice=${result.status}`);
}

/**
 * Startet den managed TS3-Container (CONTAINER_CREATED → RUNNING). OWNER-only, rate-limitiert.
 * Erfordert **explizite** TS3-Lizenzzustimmung (Checkbox). **Kein Log-Lesen, kein Secret im Client.**
 */
export async function startContainerAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');
  const licenseAccepted = formData.get('licenseAccepted') === 'on';

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `container:start:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await startManagedContainerForServer(id, user.email, licenseAccepted);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'started' || result.status === 'running') {
    redirect(`/${locale}/servers/${id}`);
  }
  // licenseRequired | invalidState | invalidPlan | writeDisabled
  //   | unavailable | unreachable | conflict | error
  redirect(`/${locale}/servers/${id}?notice=${result.status}`);
}

/**
 * Stoppt den managed TS3-Container (RUNNING → CONTAINER_CREATED, runState='stopped'). OWNER-only,
 * rate-limitiert. **Kein** Löschen/Restart/Log-Lesen; Volume/Network bleiben bestehen.
 */
export async function stopContainerAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `container:stop:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await stopManagedContainerForServer(id, user.email);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'stopped' || result.status === 'alreadyStopped') {
    redirect(`/${locale}/servers/${id}`);
  }
  // invalidState | invalidPlan | writeDisabled | unavailable | unreachable | conflict | error
  redirect(`/${locale}/servers/${id}?notice=${result.status}`);
}

/**
 * Startet den managed Container **neu** (RUNNING → Stop → Start → RUNNING). OWNER-only, rate-limitiert,
 * mit erneuter Lizenzbestätigung. **Kein** `docker restart`; keine Löschung, kein Log-Lesen.
 */
export async function restartContainerAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');
  const licenseAccepted = formData.get('licenseAccepted') === 'on';

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `container:restart:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await restartManagedContainerForServer(id, user.email, licenseAccepted);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'restarted') {
    redirect(`/${locale}/servers/${id}`);
  }
  // licenseRequired | invalidState | stopFailed | startFailed
  redirect(`/${locale}/servers/${id}?notice=${result.status}`);
}

/**
 * Entfernt den **gestoppten** managed Container (CONTAINER_CREATED → RESOURCES_PREPARED). OWNER-only,
 * rate-limitiert. **Kein** `-f`/`-v`; Volume, Network, Credentials und ServerInstance bleiben erhalten.
 */
export async function removeContainerAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `container:remove:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await removeManagedContainerForServer(id, user.email);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'removed' || result.status === 'alreadyRemoved') {
    redirect(`/${locale}/servers/${id}`);
  }
  // stillRunning | invalidState | invalidPlan | writeDisabled | unavailable | unreachable | conflict | error
  redirect(`/${locale}/servers/${id}?notice=${result.status}`);
}

/**
 * Entfernt das managed **Datenvolume** (RESOURCES_PREPARED). **Datenverlust!** OWNER-only, rate-limitiert,
 * nur mit Datenverlust- + Backup- + getippter Bestätigung. Kein `-f`; Network/Credentials/ServerInstance bleiben.
 */
export async function removeVolumeAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');
  const confirmations = {
    confirmVolumeDataLoss: formData.get('confirmVolumeDataLoss') === 'on',
    confirmBackupRecommended: formData.get('confirmBackupRecommended') === 'on',
    typedConfirmation: String(formData.get('typedConfirmation') ?? ''),
  };

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `container:volume-remove:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await removeManagedVolumeForServer(id, user.email, confirmations);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'removed' || result.status === 'alreadyRemoved') {
    redirect(`/${locale}/servers/${id}`);
  }
  // dataLossRequired | backupRequired | typedMismatch | invalidState | invalidPlan
  //   | containerStillExists | conflict | writeDisabled | unavailable | unreachable | error
  redirect(`/${locale}/servers/${id}?notice=${result.status}`);
}

/**
 * Erstellt ein **echtes read-only Volume-Backup** (serverseitig). OWNER-only, rate-limitiert. Backup-Datei
 * ist potenziell sensibel. **Kein** Restore/Download; kein freier Pfad/Image vom Client.
 */
export async function backupVolumeAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');
  const confirmations = {
    confirmBackupMayContainSensitiveData: formData.get('confirmBackupMayContainSensitiveData') === 'on',
    confirmBackupStorageResponsibility: formData.get('confirmBackupStorageResponsibility') === 'on',
    confirmContainerShouldBeStopped: formData.get('confirmContainerShouldBeStopped') === 'on',
    typedConfirmation: String(formData.get('typedConfirmation') ?? ''),
  };

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `volume:backup:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await backupManagedVolumeForServer(id, user.email, confirmations);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'created') {
    redirect(`/${locale}/servers/${id}?notice=backupCreated`);
  }
  // archived | invalidState | sensitiveDataRequired | storageRequired | containerStoppedRequired
  //   | typedMismatch | containerStillExists | volumeNotFound | volumeNotManaged | backupDirUnavailable
  //   | imageUnavailable | writeDisabled | unavailable | unreachable | error
  redirect(`/${locale}/servers/${id}?notice=${result.status}`);
}

/**
 * **Read-only** Backup-Verify (Step 035): SHA-256 neu berechnen + mit metadata.json vergleichen.
 * OWNER-only, rate-limitiert. Es wird **nichts** verändert/geladen/gelöscht; auch archivierte
 * managed Server dürfen verifizieren. Ergebnis landet als Query-Status in der Backup-Liste.
 */
export async function verifyBackupAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');
  const fileName = String(formData.get('fileName') ?? '');

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `backup:verify:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?backups=1&notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await verifyManagedVolumeBackupForServer(id, user.email, fileName);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  const file = result.fileName ? `&verifyFile=${encodeURIComponent(result.fileName)}` : '';
  redirect(`/${locale}/servers/${id}?backups=1&verify=${result.status}${file}`);
}

/**
 * Entfernt das **geteilte Voice-Network** (global). OWNER-only, rate-limitiert, nur mit Bestätigung
 * `confirmNetworkUnused`. **Kein Force**; nur wenn kein managed Container mehr existiert. Keine Volume-/
 * Container-/Credential-/ServerInstance-Löschung.
 */
export async function removeNetworkAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');
  const confirmations = { confirmNetworkUnused: formData.get('confirmNetworkUnused') === 'on' };

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `container:network-remove:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await removeManagedNetworkForServer(id, user.email, confirmations);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'removed' || result.status === 'alreadyRemoved') {
    redirect(`/${locale}/servers/${id}`);
  }
  // confirmationRequired | inUseByManagedContainers | conflict | writeDisabled | unavailable | unreachable | error
  redirect(`/${locale}/servers/${id}?notice=${result.status}`);
}

/**
 * Archiviert einen managed ServerRecord (abschließendes Deprovisioning). **Rein DB-seitig – kein Docker/
 * Agent.** OWNER-only, rate-limitiert. Credentials werden nur bei ausdrücklicher Entscheidung gelöscht.
 * **Kein Hard-Delete** der ServerInstance, keine Audit-Löschung.
 */
export async function archiveServerAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');
  const rawDecision = String(formData.get('credentialDecision') ?? '');
  const credentialDecision: CredentialDecision | undefined =
    rawDecision === 'keep' || rawDecision === 'remove' ? rawDecision : undefined;
  const confirmations = {
    confirmServerRecordArchive: formData.get('confirmServerRecordArchive') === 'on',
    credentialDecision,
    typedConfirmation: String(formData.get('typedConfirmation') ?? ''),
  };

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `server:archive:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await archiveManagedServer(id, user.email, confirmations);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'archived' || result.status === 'alreadyArchived') {
    redirect(`/${locale}/servers/${id}`);
  }
  // notManaged | invalidState | archiveConfirmRequired | credentialDecisionRequired | typedMismatch
  redirect(`/${locale}/servers/${id}?notice=${result.status}`);
}

/**
 * Löst einen **read-only** Healthcheck für einen managed Server aus (Container-Laufzeit + optional TS3).
 * OWNER-only, rate-limitiert. **Keine** Logs/Inspect/Reparatur; `provisioningStatus` bleibt unverändert.
 */
export async function healthcheckAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  const rlKey = `container:health:${user.id}`;
  if ((await checkRateLimit(rlKey, CONNECT_RATE_LIMIT)).limited) {
    redirect(`/${locale}/servers/${id}?notice=rateLimited`);
  }
  await recordRateLimitHit(rlKey);

  const result = await runManagedHealthcheck(id, user.email);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'ok') {
    redirect(`/${locale}/servers/${id}`);
  }
  // notManaged | invalidState
  redirect(`/${locale}/servers/${id}?notice=${result.status}`);
}

/**
 * Setzt/aktualisiert die Query-Adresse (Host) eines managed Servers für den read-only Healthcheck.
 * OWNER-only. Leeres Feld entfernt die Adresse (⇒ notConfigured). Host wird validiert (Step-008-Regeln).
 */
export async function updateQueryAddressAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  const id = String(formData.get('id') ?? '');
  const rawHost = String(formData.get('host') ?? '').trim();

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  let host: string | null = null;
  if (rawHost) {
    const check = validateServerHost(rawHost);
    if (!check.ok) {
      redirect(`/${locale}/servers/${id}?notice=${check.errorKey ?? 'hostInvalid'}`);
    }
    host = rawHost;
  }

  const result = await updateManagedQueryAddress(id, host, user.email);
  if (result.status === 'notFound') {
    redirect(`/${locale}/servers`);
  }
  if (result.status === 'notManaged') {
    redirect(`/${locale}/servers/${id}?notice=notManaged`);
  }
  redirect(`/${locale}/servers/${id}`);
}
