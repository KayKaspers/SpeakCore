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
