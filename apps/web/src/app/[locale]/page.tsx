import { redirect } from 'next/navigation';
import { getSetupState } from '@/core/setup';
import { getCurrentUser } from '@/lib/auth';

// Setup-Status & Session immer pro Request auswerten (kein statisches Caching).
export const dynamic = 'force-dynamic';

/**
 * Einstiegspunkt: leitet je nach Zustand weiter.
 * - Kein Owner / gesperrt → Setup-Wizard
 * - Owner vorhanden + angemeldet → Dashboard
 * - Owner vorhanden + nicht angemeldet → Login
 */
export default async function IndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if ((await getSetupState()) !== 'completed') {
    redirect(`/${locale}/setup`);
  }

  const user = await getCurrentUser();
  redirect(`/${locale}/${user ? 'dashboard' : 'login'}`);
}
