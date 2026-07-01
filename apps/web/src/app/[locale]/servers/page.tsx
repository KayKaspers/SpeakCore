import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { listServers } from '@/core/servers';
import { BrandMark } from '@/components/BrandMark';

export const dynamic = 'force-dynamic';

export default async function ServersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(await getCurrentUser())) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations('servers');
  const servers = await listServers();

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
        <Link
          href={`/${locale}/servers/new`}
          className="shrink-0 rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white"
        >
          {t('connectButton')}
        </Link>
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
                className="flex items-center justify-between rounded-sc-lg border border-sc-border bg-sc-surface p-4 hover:border-sc-border-strong"
              >
                <span>
                  <span className="block text-sc-body font-medium text-sc-text-primary">
                    {server.name}
                  </span>
                  <span className="block font-mono text-sc-caption text-sc-text-secondary">
                    {server.host}:{server.queryPort}
                  </span>
                </span>
                <span className="rounded-sc-sm bg-sc-primary/10 px-2 py-1 text-sc-caption text-sc-primary">
                  TeamSpeak 3
                </span>
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
