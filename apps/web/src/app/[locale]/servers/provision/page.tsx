import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ProvisionForm } from './ProvisionForm';

export const dynamic = 'force-dynamic';

export default async function ProvisionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    redirect(`/${locale}/login`);
  }

  // Env-Default als Vorschlag für die Query-Adresse (kein Zwang, kein Raten). UI kann ihn überschreiben.
  const defaultQueryHost = (process.env.MANAGED_TS3_QUERY_HOST ?? '').trim();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <ProvisionForm locale={locale} defaultQueryHost={defaultQueryHost} />
    </main>
  );
}
