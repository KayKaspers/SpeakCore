import { redirect } from 'next/navigation';
import { getSetupState } from '@/core/setup';
import { SetupWizard } from './SetupWizard';

export const dynamic = 'force-dynamic';

export default async function SetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const state = await getSetupState();

  // Setup ist nicht wiederholbar: existiert ein Owner, geht es zum Login.
  if (state === 'completed') {
    redirect(`/${locale}/login`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-10">
      <SetupWizard locale={locale} locked={state === 'locked'} />
    </main>
  );
}
