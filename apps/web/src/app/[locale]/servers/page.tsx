import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { listServers } from '@/core/servers';
import { BrandMark } from '@/components/BrandMark';

export const dynamic = 'force-dynamic';

function statusBadgeClass(lastStatus: string | null): string {
  if (lastStatus === 'reachable') return 'bg-sc-success/15 text-sc-success';
  if (lastStatus === 'unreachable') return 'bg-sc-error/15 text-sc-error';
  return 'bg-sc-surface-raised text-sc-text-secondary';
}
function statusDotClass(lastStatus: string | null): string {
  if (lastStatus === 'reachable') return 'bg-sc-success';
  if (lastStatus === 'unreachable') return 'bg-sc-error';
  return 'bg-sc-text-muted';
}
function managedBadgeClass(status: string | null): string {
  if (status === 'RESOURCES_PREPARED') return 'bg-sc-success/15 text-sc-success';
  if (status === 'RESOURCE_PREPARE_PARTIAL') return 'bg-sc-warning/15 text-sc-warning';
  if (status === 'RESOURCE_PREPARE_FAILED') return 'bg-sc-error/15 text-sc-error';
  return 'bg-sc-surface-raised text-sc-text-secondary';
}

export default async function ServersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(await getCurrentUser())) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations('servers');
  const servers = await listServers();

  const statusLabel = (s: string | null) =>
    s === 'reachable' ? t('status.reachable') : s === 'unreachable' ? t('status.unreachable') : t('status.statusUnknown');

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BrandMark className="h-7 w-7" />
            <h1 className="text-sc-h1 font-semibold text-sc-text-primary">{t('title')}</h1>
          </div>
          <p className="mt-1 text-sc-sm text-sc-text-secondary">{t('subtitle')}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            href={`/${locale}/servers/provision`}
            className="rounded-sc-md border border-sc-border-strong px-4 py-2 text-center text-sc-sm text-sc-text-secondary"
          >
            {t('provision.openButton')}
          </Link>
          <Link
            href={`/${locale}/servers/new`}
            className="rounded-sc-md bg-sc-primary px-4 py-2 text-center text-sc-sm font-medium text-white"
          >
            {t('connectButton')}
          </Link>
        </div>
      </header>

      {servers.length === 0 ? (
        <section className="rounded-sc-lg border border-sc-border bg-sc-surface p-8 text-center">
          <p className="text-sc-sm text-sc-text-secondary">{t('empty')}</p>
          <Link
            href={`/${locale}/servers/new`}
            className="mt-4 inline-block rounded-sc-md border border-sc-border-strong px-4 py-2 text-sc-sm text-sc-text-primary"
          >
            {t('connectButton')}
          </Link>
        </section>
      ) : (
        <ul className="space-y-3">
          {servers.map((server) => (
            <li key={server.id}>
              <Link
                href={`/${locale}/servers/${server.id}`}
                className="flex items-center justify-between gap-4 rounded-sc-lg border border-sc-border bg-sc-surface p-4 hover:border-sc-border-strong"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sc-body font-medium text-sc-text-primary">
                    {server.name}
                  </span>
                  {server.mode === 'managed' ? (
                    <span className="block font-mono text-sc-caption text-sc-text-secondary">
                      {t('managed.label')} · {t('managed.containerNotCreated')}
                    </span>
                  ) : (
                    <>
                      <span className="block font-mono text-sc-caption text-sc-text-secondary">
                        {server.host}:{server.queryPort} · TeamSpeak 3
                      </span>
                      <span className="block text-sc-caption text-sc-text-muted">
                        {t('status.lastCheck')}:{' '}
                        {server.lastStatusCheckedAt
                          ? new Date(server.lastStatusCheckedAt).toLocaleString(locale)
                          : t('status.never')}
                      </span>
                    </>
                  )}
                </span>
                {server.mode === 'managed' ? (
                  <span
                    className={`inline-flex shrink-0 items-center gap-2 rounded-sc-sm px-3 py-1 text-sc-sm font-medium ${managedBadgeClass(server.provisioningStatus)}`}
                  >
                    {t(`managed.status.${server.provisioningStatus ?? 'DRAFT'}`)}
                  </span>
                ) : (
                  <span
                    className={`inline-flex shrink-0 items-center gap-2 rounded-sc-sm px-3 py-1 text-sc-sm font-medium ${statusBadgeClass(server.lastStatus)}`}
                  >
                    <span className={`inline-block h-2 w-2 rounded-full ${statusDotClass(server.lastStatus)}`} aria-hidden />
                    {statusLabel(server.lastStatus)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-6">
        <Link
          href={`/${locale}/dashboard`}
          className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('backToDashboard')}
        </Link>
      </footer>
    </main>
  );
}
