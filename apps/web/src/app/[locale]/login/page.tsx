import { redirect } from 'next/navigation';
import { getSetupState } from '@/core/setup';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if ((await getSetupState()) !== 'completed') {
    redirect(`/${locale}/setup`);
  }
  if (await getCurrentUser()) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <LoginForm locale={locale} />
    </main>
  );
}
