import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { APP_VERSION, NAV_KEYS, NDF_STEP } from '@speakcore/shared';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/core/db';
import { SETTING_SYSTEM_MODE, normalizeSystemMode } from '@/core/setup';
import { logoutAction } from '../login/actions';

export const dynamic = 'force-dynamic';

/** Geschützte Dashboard-Route. Ohne gültige Session → Login. */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations('dashboard');
  const tNav = await getTranslations('nav');
  const tApp = await getTranslations('app');

  const modeSetting = await prisma.setting.findUnique({ where: { key: SETTING_SYSTEM_MODE } });
  const mode = normalizeSystemMode(modeSetting?.value ?? 'simple');
  const displayName = user.displayName?.trim() || user.email;

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      {/* Sidebar */}
      <aside className="flex w-full flex-col border-b border-white/10 bg-sc-surface sm:w-64 sm:border-b-0 sm:border-r">
        <div className="flex items-center gap-2 px-6 py-5">
          <span className="inline-block h-3 w-3 rounded-full bg-sc-accent" aria-hidden />
          <span className="text-sc-h2 font-semibold tracking-tight text-sc-text-primary">
            {tApp('name')}
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {NAV_KEYS.map((key, index) => {
            // 'systemcheck' verlinkt auf die Demo-Seite; übrige bleiben Platzhalter.
            if (key === 'systemcheck') {
              return (
                <Link
                  key={key}
                  href={`/${locale}/systemcheck`}
                  className="rounded-sc-md px-3 py-2 text-sc-sm text-sc-text-secondary hover:text-sc-text-primary"
                >
                  {tNav(key)}
                </Link>
              );
            }
            return (
              <span
                key={key}
                className={
                  index === 0
                    ? 'rounded-sc-md bg-sc-primary/10 px-3 py-2 text-sc-sm font-medium text-sc-primary'
                    : 'cursor-default rounded-sc-md px-3 py-2 text-sc-sm text-sc-text-secondary'
                }
                aria-disabled={index !== 0}
              >
                {tNav(key)}
              </span>
            );
          })}
        </nav>
        <div className="px-6 py-4 text-sc-caption text-sc-text-secondary">
          v{APP_VERSION} · {NDF_STEP}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 px-6 py-6 sm:px-8">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-sc-h1 font-semibold text-sc-text-primary">{t('title')}</h1>
            <p className="mt-1 text-sc-sm text-sc-text-secondary">
              {t('welcome', { name: displayName })}
            </p>
          </div>
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="rounded-sc-md border border-white/15 px-3 py-2 text-sc-sm text-sc-text-secondary"
            >
              {t('logout')}
            </button>
          </form>
        </header>

        <section className="max-w-xl rounded-sc-lg border border-white/10 bg-sc-surface p-6">
          <div className="flex items-center justify-between">
            <span className="text-sc-sm text-sc-text-secondary">{t('statusLabel')}</span>
            <span className="inline-flex items-center gap-2 rounded-sc-sm bg-sc-success/15 px-3 py-1 text-sc-sm font-medium text-sc-success">
              <span className="inline-block h-2 w-2 rounded-full bg-sc-success" aria-hidden />
              {t('statusReady')}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sc-sm text-sc-text-secondary">{t('modeLabel')}</span>
            <span className="text-sc-sm text-sc-text-primary">{mode}</span>
          </div>
          <p className="mt-4 text-sc-sm text-sc-text-secondary">{t('placeholderHint')}</p>
          <p className="mt-6 rounded-sc-sm bg-sc-background px-3 py-2 font-mono text-sc-caption text-sc-text-secondary">
            {t('skeletonNote')}
          </p>
        </section>
      </main>
    </div>
  );
}
