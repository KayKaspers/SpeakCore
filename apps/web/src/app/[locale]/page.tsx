import { getTranslations } from 'next-intl/server';
import { APP_VERSION, NAV_KEYS, NDF_STEP } from '@speakcore/shared';

/**
 * Platzhalter-Dashboard (NDF Step 002).
 * Bewusst ohne Funktionen – nur Enterprise-Dark-Skeleton mit Navigations-Platzhaltern.
 */
export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const tNav = await getTranslations('nav');
  const tApp = await getTranslations('app');

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-white/10 bg-sc-surface">
        <div className="flex items-center gap-2 px-6 py-5">
          <span className="inline-block h-3 w-3 rounded-full bg-sc-accent" aria-hidden />
          <span className="text-sc-h2 font-semibold tracking-tight text-sc-text-primary">
            {tApp('name')}
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {NAV_KEYS.map((key, index) => (
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
          ))}
        </nav>
        <div className="px-6 py-4 text-sc-caption text-sc-text-secondary">
          v{APP_VERSION} · {NDF_STEP}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 px-8 py-6">
        <header className="mb-8">
          <h1 className="text-sc-h1 font-semibold text-sc-text-primary">{t('title')}</h1>
          <p className="mt-1 text-sc-sm text-sc-text-secondary">{tApp('tagline')}</p>
        </header>

        <section className="max-w-xl rounded-sc-lg border border-white/10 bg-sc-surface p-6">
          <div className="flex items-center justify-between">
            <span className="text-sc-sm text-sc-text-secondary">{t('statusLabel')}</span>
            <span className="inline-flex items-center gap-2 rounded-sc-sm bg-sc-warning/15 px-3 py-1 text-sc-sm font-medium text-sc-warning">
              <span className="inline-block h-2 w-2 rounded-full bg-sc-warning" aria-hidden />
              {t('statusPending')}
            </span>
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
