'use server';

import { redirect } from 'next/navigation';
import { getSetupState } from '@/core/setup';
import { getUserByEmail } from '@/core/users';
import { verifyPassword } from '@/core/password';
import { logAudit } from '@/core/audit';
import { createSession } from '@/core/session';
import { setSessionCookie, destroySession } from '@/lib/auth';

export interface LoginActionState {
  error?: boolean;
  errorKey?: string;
}

/**
 * Login-Action. Gibt bei falschen Zugangsdaten eine generische Meldung zurück
 * (kein Leak, ob E-Mail existiert). Rate-Limiting ist noch nicht umgesetzt (siehe RISKS R-08).
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

  const user = await getUserByEmail(email);
  const ok = user ? await verifyPassword(user.passwordHash, password) : false;

  if (!user || !ok) {
    await logAudit({ action: 'login.failure', actor: email || 'unknown', result: 'failure' });
    return { error: true, errorKey: 'error' };
  }

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
