'use server';

import { redirect } from 'next/navigation';
import { checkPasswordPair, isPlausibleEmail } from '@/core/password';
import { getSetupState, normalizeSystemMode } from '@/core/setup';
import { createOwner, OwnerAlreadyExistsError } from '@/core/users';
import { createSession } from '@/core/session';
import { setSessionCookie } from '@/lib/auth';

export interface SetupActionState {
  errorKey?: string;
}

/**
 * Server Action zum Anlegen des Owner-Accounts und Abschluss des Setups.
 * Sicherheits-Hinweis: Alle Prüfungen sind serverseitig autoritativ. Die Client-Validierung
 * im Wizard dient nur der UX. CSRF: Next.js Server Actions sind Same-Origin-geschützt
 * (Origin-/Host-Abgleich); zusätzlich Cookie SameSite=Lax.
 */
export async function createOwnerAction(
  _prev: SetupActionState,
  formData: FormData,
): Promise<SetupActionState> {
  const locale = String(formData.get('locale') ?? 'de');
  const email = String(formData.get('email') ?? '');
  const displayName = String(formData.get('displayName') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const mode = normalizeSystemMode(String(formData.get('mode') ?? 'simple'));

  // Setup darf nur ausgeführt werden, solange noch kein Account existiert.
  const state = await getSetupState();
  if (state === 'completed') return { errorKey: 'ownerExists' };
  if (state === 'locked') return { errorKey: 'locked' };

  if (!isPlausibleEmail(email)) return { errorKey: 'emailInvalid' };

  const pw = checkPasswordPair(password, confirm);
  if (pw.mismatch) return { errorKey: 'passwordMismatch' };
  if (!pw.valid) return { errorKey: 'passwordWeak' };

  let userId: string;
  try {
    const user = await createOwner({ email, displayName, password, mode });
    userId = user.id;
  } catch (err) {
    if (err instanceof OwnerAlreadyExistsError) return { errorKey: 'ownerExists' };
    return { errorKey: 'generic' };
  }

  // Direkt anmelden: Session anlegen + Cookie setzen.
  const { token, expiresAt } = await createSession(userId);
  await setSessionCookie(token, expiresAt);

  redirect(`/${locale}/dashboard`);
}
