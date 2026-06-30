import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { PreflightInput, PreflightSeverity } from '@speakcore/types';
import { runPreflight } from '@speakcore/shared';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Beispiel-Eingabe (NDF Step 005): KEINE echte Systemmessung. Spätere Agent-Sonden liefern
// diese Werte; hier dienen sie nur der Demonstration der Bewertungslogik.
const DEMO_INPUT: PreflightInput = {
  environment: 'proxmox-lxc',
  profile: 'small',
  snapshot: {
    cpuCores: 2,
    ramGb: 4,
    freeStorageGb: 40,
    docker: 'present',
    dockerCompose: 'present',
    firewall: 'present',
    dns: 'present',
    ipv4: true,
    backupStorageGb: 20,
    // uploadMbps bewusst unbekannt
  },
};

const severityText: Record<PreflightSeverity, string> = {
  green: 'text-sc-success',
  yellow: 'text-sc-warning',
  red: 'text-sc-error',
};
const severityBg: Record<PreflightSeverity, string> = {
  green: 'bg-sc-success/15 text-sc-success',
  yellow: 'bg-sc-warning/15 text-sc-warning',
  red: 'bg-sc-error/15 text-sc-error',
};
const severityDot: Record<PreflightSeverity, string> = {
  green: 'bg-sc-success',
  yellow: 'bg-sc-warning',
  red: 'bg-sc-error',
};

export default async function SystemcheckPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(await getCurrentUser())) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations('systemcheck');
  const result = runPreflight(DEMO_INPUT);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-sc-accent" aria-hidden />
          <h1 className="text-sc-h1 font-semibold text-sc-text-primary">{t('title')}</h1>
        </div>
        <p className="mt-1 text-sc-sm text-sc-text-secondary">
          {t('subtitle')} · {t('intro')}
        </p>
        <p className="mt-2 inline-block rounded-sc-sm bg-sc-warning/15 px-2 py-1 text-sc-caption text-sc-warning">
          {t('demoNotice')}
        </p>
      </header>

      {/* Gesamtbewertung */}
      <section className="mb-6 rounded-sc-lg border border-white/10 bg-sc-surface p-6">
        <div className="flex items-center justify-between">
          <span className="text-sc-sm text-sc-text-secondary">{t('overall')}</span>
          <span
            className={`inline-flex items-center gap-2 rounded-sc-sm px-3 py-1 text-sc-sm font-medium ${severityBg[result.overall]}`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${severityDot[result.overall]}`} aria-hidden />
            {t(`severity.${result.overall}`)}
          </span>
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Dienste */}
        <section className="rounded-sc-lg border border-white/10 bg-sc-surface p-6">
          <h2 className="mb-3 text-sc-h2 font-medium text-sc-text-primary">{t('sections.services')}</h2>
          <ul className="space-y-2">
            {result.services.map((s) => (
              <li key={s.service} className="flex items-center justify-between text-sc-sm">
                <span className="flex items-center gap-2 text-sc-text-primary">
                  <span className={`inline-block h-2 w-2 rounded-full ${severityDot[s.severity]}`} aria-hidden />
                  {t(`services.${s.service}`)}
                </span>
                <span className="text-sc-caption text-sc-text-secondary">
                  {s.available ? t('services.available') : t('services.future')}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Limitierende Faktoren */}
        <section className="rounded-sc-lg border border-white/10 bg-sc-surface p-6">
          <h2 className="mb-3 text-sc-h2 font-medium text-sc-text-primary">{t('sections.limiting')}</h2>
          {result.limitingFactors.length === 0 ? (
            <p className="text-sc-sm text-sc-text-secondary">—</p>
          ) : (
            <ul className="space-y-2">
              {result.limitingFactors.map((f) => (
                <li key={f.category} className="text-sc-sm">
                  <span className={`font-medium ${severityText[f.severity]}`}>
                    {t(`category.${f.category}`)}
                  </span>
                  {f.detailKey ? (
                    <span className="text-sc-text-secondary"> – {t(`details.${f.detailKey}`)}</span>
                  ) : null}
                  {f.value !== undefined ? (
                    <span className="text-sc-text-secondary">
                      {' '}
                      ({f.value} {f.unit}
                      {f.recommended !== undefined ? `, ≥ ${f.recommended} ${f.unit}` : ''})
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Empfohlene Upgrades */}
      {result.upgrades.length > 0 && (
        <section className="mt-6 rounded-sc-lg border border-white/10 bg-sc-surface p-6">
          <h2 className="mb-3 text-sc-h2 font-medium text-sc-text-primary">{t('sections.upgrades')}</h2>
          <ul className="list-inside list-disc space-y-1 text-sc-sm text-sc-text-secondary">
            {result.upgrades.map((u) => (
              <li key={u.key}>{t(`upgrades.${u.key}`, u.params ?? {})}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-6 flex items-center justify-between">
        <p className="max-w-md text-sc-caption text-sc-text-secondary">{t('disclaimer')}</p>
        <Link
          href={`/${locale}/dashboard`}
          className="shrink-0 rounded-sc-md border border-white/15 px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('backToDashboard')}
        </Link>
      </footer>
    </main>
  );
}
