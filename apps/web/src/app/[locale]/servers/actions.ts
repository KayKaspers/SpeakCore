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
