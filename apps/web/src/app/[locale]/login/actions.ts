'use server';

import { redirect } from 'next/navigation';
import { getSetupState } from '@/core/setup';
import { getUserByEmail } from '@/core/users';
import { verifyPassword } from '@/core/password';
import { logAudit } from '@/core/audit';
import { createSession } from '@/core/session';
import {
  LOGIN_RATE_LIMIT,
  checkRateLimit,
  cleanupRateLimits,
  clearRateLimit,
  recordRateLimitHit,
} from '@/core/rate-limit';
import { setSessionCookie, destroySession } from '@/lib/auth';
import { getClientIp } from '@/lib/request';

export interface LoginActionState {
  error?: boolean;
  errorKey?: string;
}

/**
 * Login-Action mit serverseitigem Rate-Limiting (IP + Identifier, DB-gestützt).
 * Fehlermeldungen bleiben generisch (kein User-Enumeration-Leak).
 */
export async function loginAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const locale = String(formData.get('locale') ?? 'de');
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  // Wenn noch kein Owner existiert, gehört der Nutzer ins Setup.
  if ((await getSetupState()) !== 'completed') {
    redirect(`/${locale}/setup`);
  }

  const ip = await getClientIp();
  const ipKey = `login:ip:${ip}`;
  const idKey = `login:id:${email || 'unknown'}`;

  const [ipLimit, idLimit] = await Promise.all([
    checkRateLimit(ipKey, LOGIN_RATE_LIMIT),
    checkRateLimit(idKey, LOGIN_RATE_LIMIT),
  ]);
  if (ipLimit.limited || idLimit.limited) {
    await logAudit({ action: 'login.rate_limited', actor: email || ip, result: 'failure' });
    return { error: true, errorKey: 'rateLimited' };
  }

  const user = await getUserByEmail(email);
  const ok = user ? await verifyPassword(user.passwordHash, password) : false;

  if (!user || !ok) {
    await Promise.all([recordRateLimitHit(ipKey), recordRateLimitHit(idKey)]);
    await logAudit({ action: 'login.failure', actor: email || 'unknown', result: 'failure' });
    return { error: true, errorKey: 'error' };
  }

  // Erfolg: Limits für diesen Nutzer/IP zurücksetzen + Gelegenheits-Cleanup.
  await Promise.all([clearRateLimit(ipKey), clearRateLimit(idKey)]);
  await cleanupRateLimits();
  await logAudit({ action: 'login.success', actor: user.email });

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  redirect(`/${locale}/dashboard`);
}

/** Logout-Action: Session entwerten, Cookie löschen, zur Login-Seite. */
export async function logoutAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'de');
  await destroySession();
  await logAudit({ action: 'logout', actor: 'self' });
  redirect(`/${locale}/login`);
}
