import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { getServer, getServerStatus } from '@/core/servers';
import { BrandMark } from '@/components/BrandMark';

export const dynamic = 'force-dynamic';

function formatUptime(seconds: number | undefined): string {
  if (seconds === undefined) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!(await getCurrentUser())) {
    redirect(`/${locale}/login`);
  }

  const server = await getServer(id);
  if (!server) {
    redirect(`/${locale}/servers`);
  }

  const t = await getTranslations('servers');
  const status = await getServerStatus(id);

  const rows: { label: string; value: string }[] = [
    { label: t('status.name'), value: status.name ?? t('status.notAvailable') },
    { label: t('status.version'), value: status.version ?? t('status.notAvailable') },
    { label: t('status.platform'), value: status.platform ?? t('status.notAvailable') },
    {
      label: t('status.clients'),
      value:
        status.clientsOnline !== undefined && status.maxClients !== undefined
          ? `${status.clientsOnline} / ${status.maxClients}`
          : t('status.notAvailable'),
    },
    { label: t('status.uptime'), value: formatUptime(status.uptimeSeconds) },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center gap-2">
        <BrandMark className="h-7 w-7" />
        <div>
          <h1 className="text-sc-h1 font-semibold text-sc-text-primary">{server.name}</h1>
          <p className="font-mono text-sc-caption text-sc-text-secondary">
            {server.host}:{server.queryPort}
          </p>
        </div>
      </header>

      <section className="rounded-sc-lg border border-sc-border bg-sc-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sc-h2 font-medium text-sc-text-primary">{t('status.title')}</h2>
          <span
            className={`inline-flex items-center gap-2 rounded-sc-sm px-3 py-1 text-sc-sm font-medium ${
              status.reachable ? 'bg-sc-success/15 text-sc-success' : 'bg-sc-error/15 text-sc-error'
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${status.reachable ? 'bg-sc-success' : 'bg-sc-error'}`}
              aria-hidden
            />
            {status.reachable ? t('status.reachable') : t('status.unreachable')}
          </span>
        </div>

        {status.reachable && (
          <dl className="space-y-2 text-sc-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-sc-text-secondary">{row.label}</dt>
                <dd className="text-sc-text-primary">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {!status.reachable && (
          <p className="text-sc-sm text-sc-text-secondary">{t('status.unreachableHint')}</p>
        )}
      </section>

      <footer className="mt-6 flex items-center justify-between">
        <p className="text-sc-caption text-sc-text-muted">{t('status.readonlyNote')}</p>
        <Link
          href={`/${locale}/servers`}
          className="shrink-0 rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('backToList')}
        </Link>
      </footer>
    </main>
  );
}
