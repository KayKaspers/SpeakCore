import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { getServer } from '@/core/servers';
import { BrandMark } from '@/components/BrandMark';
import { prepareContainerAction, refreshServerAction } from '../actions';
import { RemoveServerButton } from '../RemoveServerButton';

export const dynamic = 'force-dynamic';

function formatUptime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export default async function ServerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { locale, id } = await params;
  const { notice } = await searchParams;
  if (!(await getCurrentUser())) {
    redirect(`/${locale}/login`);
  }

  const server = await getServer(id);
  if (!server) {
    redirect(`/${locale}/servers`);
  }

  const t = await getTranslations('servers');
  const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleString(locale) : t('status.never'));

  // Managed-Ansicht: vorbereitete Ressourcen, KEIN Container/Start, keine Aktionen.
  if (server.mode === 'managed') {
    const provStatus = server.provisioningStatus ?? 'DRAFT';
    const badge =
      provStatus === 'RESOURCES_PREPARED'
        ? 'bg-sc-success/15 text-sc-success'
        : provStatus === 'RESOURCE_PREPARE_PARTIAL'
          ? 'bg-sc-warning/15 text-sc-warning'
          : provStatus === 'RESOURCE_PREPARE_FAILED'
            ? 'bg-sc-error/15 text-sc-error'
            : 'bg-sc-surface-raised text-sc-text-secondary';
    const rows: { label: string; value: string }[] = [
      { label: t('managed.network'), value: server.managedNetworkName ?? t('status.notAvailable') },
      { label: t('managed.volume'), value: server.managedVolumeName ?? t('status.notAvailable') },
      { label: t('managed.container'), value: server.managedContainerName ?? t('status.notAvailable') },
      { label: t('managed.preparedAt'), value: fmtDate(server.resourcesPreparedAt) },
    ];
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <header className="mb-6 flex items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <div>
            <h1 className="text-sc-h1 font-semibold text-sc-text-primary">{server.name}</h1>
            <p className="font-mono text-sc-caption text-sc-text-secondary">{t('managed.label')}</p>
          </div>
        </header>

        <section className="rounded-sc-lg border border-sc-border bg-sc-surface p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sc-h2 font-medium text-sc-text-primary">{t('managed.provisioningStatus')}</h2>
            <span className={`rounded-sc-sm px-3 py-1 text-sc-sm font-medium ${badge}`}>
              {t(`managed.status.${provStatus}`)}
            </span>
          </div>

          {server.lastProvisioningErrorKey && (
            <p className="mb-4 rounded-sc-sm bg-sc-warning/15 px-3 py-2 text-sc-sm text-sc-warning">
              {t(`managed.error.${server.lastProvisioningErrorKey}`)}
            </p>
          )}

          {notice &&
            ['encryptionMissing', 'invalidState', 'invalidPlan', 'rateLimited'].includes(notice) && (
              <p className="mb-4 rounded-sc-sm bg-sc-warning/15 px-3 py-2 text-sc-sm text-sc-warning">
                {t(`managed.notice.${notice}`)}
              </p>
            )}

          <dl className="space-y-2 text-sc-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-sc-text-secondary">{row.label}</dt>
                <dd className="font-mono text-sc-text-primary">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 space-y-1 border-t border-sc-border pt-4 text-sc-caption text-sc-text-muted">
            <p>• {t('managed.containerNotCreated')}</p>
            <p>• {t('managed.noServerStarted')}</p>
            {provStatus === 'RESOURCES_PREPARED' && <p>• {t('managed.prepareHintSecret')}</p>}
            {provStatus === 'CONTAINER_PENDING' && <p>• {t('managed.nextStepCreate')}</p>}
          </div>

          {provStatus === 'RESOURCES_PREPARED' && (
            <form action={prepareContainerAction} className="mt-6">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={server.id} />
              <button
                type="submit"
                className="rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white"
              >
                {t('managed.prepareButton')}
              </button>
            </form>
          )}
        </section>

        <footer className="mt-6">
          <Link
            href={`/${locale}/servers`}
            className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
          >
            {t('backToList')}
          </Link>
        </footer>
      </main>
    );
  }

  const reachable = server.lastStatus === 'reachable';

  const rows: { label: string; value: string }[] = [
    { label: t('status.name'), value: server.statusName ?? t('status.notAvailable') },
    { label: t('status.version'), value: server.statusVersion ?? t('status.notAvailable') },
    { label: t('status.platform'), value: server.statusPlatform ?? t('status.notAvailable') },
    {
      label: t('status.clients'),
      value:
        server.statusClientsOnline !== null && server.statusMaxClients !== null
          ? `${server.statusClientsOnline} / ${server.statusMaxClients}`
          : t('status.notAvailable'),
    },
    { label: t('status.uptime'), value: formatUptime(server.statusUptimeSeconds) },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center gap-2">
        <BrandMark className="h-7 w-7" />
        <div>
          <h1 className="text-sc-h1 font-semibold text-sc-text-primary">{server.name}</h1>
          <p className="font-mono text-sc-caption text-sc-text-secondary">
            {server.host}:{server.queryPort} · {t('status.readonlyBadge')}
          </p>
        </div>
      </header>

      {notice === 'rateLimited' && (
        <p className="mb-4 rounded-sc-md bg-sc-warning/15 px-4 py-3 text-sc-sm text-sc-warning">
          {t('errors.rateLimited')}
        </p>
      )}

      <section className="rounded-sc-lg border border-sc-border bg-sc-surface p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-sc-h2 font-medium text-sc-text-primary">{t('status.title')}</h2>
          <span
            className={`inline-flex items-center gap-2 rounded-sc-sm px-3 py-1 text-sc-sm font-medium ${
              reachable ? 'bg-sc-success/15 text-sc-success' : 'bg-sc-error/15 text-sc-error'
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${reachable ? 'bg-sc-success' : 'bg-sc-error'}`}
              aria-hidden
            />
            {reachable ? t('status.reachable') : t('status.unreachable')}
          </span>
        </div>

        {reachable ? (
          <dl className="space-y-2 text-sc-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-sc-text-secondary">{row.label}</dt>
                <dd className="text-sc-text-primary">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sc-sm text-sc-text-secondary">
            {server.statusMessageKey
              ? t(`errors.${server.statusMessageKey}`)
              : t('status.unreachableHint')}
          </p>
        )}

        <dl className="mt-4 space-y-1 border-t border-sc-border pt-4 text-sc-caption text-sc-text-muted">
          <div className="flex justify-between gap-4">
            <dt>{t('status.lastCheck')}</dt>
            <dd>{fmtDate(server.lastStatusCheckedAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{t('status.lastConnected')}</dt>
            <dd>{fmtDate(server.lastConnectedAt)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <form action={refreshServerAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={server.id} />
            <button
              type="submit"
              className="rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white"
            >
              {t('status.refresh')}
            </button>
          </form>
          <RemoveServerButton locale={locale} id={server.id} />
        </div>
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
