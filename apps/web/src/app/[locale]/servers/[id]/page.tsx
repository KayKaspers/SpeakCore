import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { getServer } from '@/core/servers';
import { formatBackupSize, listManagedVolumeBackupsForServer, shortChecksum } from '@/core/backup-list';
import { BrandMark } from '@/components/BrandMark';
import {
  backfillChecksumAction,
  createContainerAction,
  healthcheckAction,
  prepareContainerAction,
  refreshServerAction,
  startContainerAction,
  updateQueryAddressAction,
  verifyBackupAction,
} from '../actions';
import { RemoveServerButton } from '../RemoveServerButton';
import { StopContainerButton } from '../StopContainerButton';
import { RemoveContainerButton } from '../RemoveContainerButton';
import { RestartContainerButton } from '../RestartContainerButton';
import { RemoveVolumeButton } from '../RemoveVolumeButton';
import { BackupVolumeButton } from '../BackupVolumeButton';
import { RemoveNetworkButton } from '../RemoveNetworkButton';
import { ArchiveServerButton } from '../ArchiveServerButton';

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
  searchParams: Promise<{
    notice?: string;
    backups?: string;
    verify?: string;
    verifyFile?: string;
    download?: string;
    backfill?: string;
  }>;
}) {
  const { locale, id } = await params;
  const {
    notice,
    backups: backupsParam,
    verify,
    verifyFile,
    download,
    backfill,
  } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const server = await getServer(id);
  if (!server) {
    redirect(`/${locale}/servers`);
  }

  const t = await getTranslations('servers');
  const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleString(locale) : t('status.never'));

  // Read-only Export (Step 029): nicht-geheime Metadaten + optional Audit-Historie, ohne Secrets.
  const exportCard = (
    <section className="mt-6 rounded-sc-lg border border-sc-border bg-sc-surface p-4">
      <h2 className="text-sc-sm font-medium text-sc-text-primary">{t('managed.export.title')}</h2>
      <ul className="mt-1 space-y-1 text-sc-caption text-sc-text-muted">
        <li>• {t('managed.export.hintNoSecrets')}</li>
        <li>• {t('managed.export.hintAuditMaybe')}</li>
        <li>• {t('managed.export.hintNoRestore')}</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/${locale}/servers/${server.id}/export`}
          className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('managed.export.downloadButton')}
        </a>
        <a
          href={`/${locale}/servers/${server.id}/export?audit=1`}
          className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('managed.export.downloadWithAudit')}
        </a>
      </div>
    </section>
  );

  // Backup-Konzept (Step 030): nicht-ausführende Info-Karte. Kein echtes Backup, kein Download.
  const backupInfoCard = (
    <section className="mt-6 rounded-sc-lg border border-sc-border bg-sc-surface-raised p-4">
      <h2 className="text-sc-sm font-medium text-sc-text-primary">{t('managed.backup.title')}</h2>
      <ul className="mt-1 space-y-1 text-sc-caption text-sc-text-muted">
        <li>• {t('managed.backup.prereq')}</li>
        <li>• {t('managed.backup.sensitive')}</li>
        <li>• {t('managed.backup.stoppedRecommended')}</li>
        <li>• {t('managed.backup.notDownload')}</li>
      </ul>
    </section>
  );

  // Read-only Backup-Liste (Step 033): NUR Sichtbarkeit – kein Download/Restore/Delete, keine
  // Docker-Aktion. OWNER-only; wird erst nach Klick geladen (?backups=1), auch für archivierte Server.
  const showBackupList =
    backupsParam === '1' && user.role === 'OWNER' && server.mode === 'managed';
  const backupList = showBackupList
    ? await listManagedVolumeBackupsForServer(server.id, user.email)
    : null;
  const backupListCard =
    server.mode === 'managed' && user.role === 'OWNER' ? (
      <section className="mt-6 rounded-sc-lg border border-sc-border bg-sc-surface p-4">
        <h2 className="text-sc-sm font-medium text-sc-text-primary">{t('managed.backupList.title')}</h2>
        <ul className="mt-1 space-y-1 text-sc-caption text-sc-text-muted">
          <li>• {t('managed.backupList.sensitiveHint')}</li>
          <li>• {t('managed.backupList.readOnlyHint')}</li>
          <li>• {t('managed.backupList.checksumHint')}</li>
          <li>• {t('managed.backupList.downloadHint')}</li>
          <li>• {t('managed.backupList.deleteNotActiveHint')}</li>
        </ul>
        {backupList &&
          verify &&
          [
            'valid',
            'mismatch',
            'metadataMissing',
            'checksumMissing',
            'backupNotFound',
            'metadataInvalid',
            'invalid',
            'backupDirUnavailable',
            'error',
            'unavailable',
            'unreachable',
            'notManaged',
          ].includes(verify) && (
            <div
              className={`mt-3 rounded-sc-sm px-3 py-2 text-sc-sm ${
                verify === 'valid'
                  ? 'bg-sc-success/15 text-sc-success'
                  : verify === 'mismatch'
                    ? 'bg-sc-error/15 text-sc-error'
                    : 'bg-sc-warning/15 text-sc-warning'
              }`}
            >
              <p>{t(`managed.backupList.verifyResult.${verify}`)}</p>
              {verifyFile && (
                <p className="mt-1 break-all font-mono text-sc-caption">{verifyFile}</p>
              )}
            </div>
          )}
        {backupList &&
          download &&
          [
            'invalid',
            'notManaged',
            'sensitiveDataRequired',
            'storageRequired',
            'typedMismatch',
            'rateLimited',
            'mismatch',
            'checksumMissing',
            'metadataMissing',
            'metadataInvalid',
            'backupNotFound',
            'backupDirUnavailable',
            'unreachable',
            'error',
          ].includes(download) && (
            <div
              className={`mt-3 rounded-sc-sm px-3 py-2 text-sc-sm ${
                download === 'mismatch'
                  ? 'bg-sc-error/15 text-sc-error'
                  : 'bg-sc-warning/15 text-sc-warning'
              }`}
            >
              <p>{t(`managed.backupList.downloadResult.${download}`)}</p>
            </div>
          )}
        {backupList &&
          backfill &&
          [
            'updated',
            'alreadyPresent',
            'metadataMissing',
            'metadataInvalid',
            'backupNotFound',
            'invalid',
            'notManaged',
            'backupDirUnavailable',
            'unavailable',
            'unreachable',
            'error',
          ].includes(backfill) && (
            <div
              className={`mt-3 rounded-sc-sm px-3 py-2 text-sc-sm ${
                backfill === 'updated'
                  ? 'bg-sc-success/15 text-sc-success'
                  : 'bg-sc-warning/15 text-sc-warning'
              }`}
            >
              <p>{t(`managed.backupList.backfillResult.${backfill}`)}</p>
            </div>
          )}
        {!backupList && (
          <div className="mt-3">
            <Link
              href={`/${locale}/servers/${server.id}?backups=1`}
              className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
            >
              {t('managed.backupList.showButton')}
            </Link>
          </div>
        )}
        {backupList && backupList.status === 'ok' && (
          <div className="mt-3 space-y-2">
            {(backupList.backups ?? []).length === 0 ? (
              <p className="text-sc-sm text-sc-text-secondary">{t('managed.backupList.empty')}</p>
            ) : (
              <>
                <p className="text-sc-caption text-sc-text-muted">
                  {t('managed.backupList.countLabel', { count: (backupList.backups ?? []).length })}
                </p>
                <ul className="space-y-2">
                  {(backupList.backups ?? []).map((b) => (
                    <li key={b.fileName} className="rounded-sc-md border border-sc-border p-2">
                      <p className="break-all font-mono text-sc-caption text-sc-text-primary">
                        {b.fileName}
                      </p>
                      <p className="mt-1 text-sc-caption text-sc-text-secondary">
                        {formatBackupSize(b.sizeBytes)} · {t('managed.backupList.createdAt')}{' '}
                        {new Date(b.createdAt).toLocaleString(locale)} ·{' '}
                        {t('managed.backupList.modifiedAt')}{' '}
                        {new Date(b.modifiedAt).toLocaleString(locale)}
                      </p>
                      <p className="mt-1 text-sc-caption text-sc-text-muted">
                        {t('managed.backupList.metadataLabel')}:{' '}
                        {t(`managed.backupList.metadata.${b.metadataStatus}`)}
                        {' · '}
                        {b.metadata?.checksum ? (
                          <span title={b.metadata.checksum.value}>
                            SHA-256:{' '}
                            <span className="font-mono">{shortChecksum(b.metadata.checksum.value)}</span>
                          </span>
                        ) : (
                          <span>{t('managed.backupList.checksumMissing')}</span>
                        )}
                      </p>
                      {b.metadata?.checksum && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-sc-caption text-sc-text-muted">
                            {t('managed.backupList.checksumShow')}
                          </summary>
                          <p className="mt-1 break-all font-mono text-sc-caption text-sc-text-secondary">
                            {b.metadata.checksum.value}
                          </p>
                        </details>
                      )}
                      <form action={verifyBackupAction} className="mt-2">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={server.id} />
                        <input type="hidden" name="fileName" value={b.fileName} />
                        <button
                          type="submit"
                          className="rounded-sc-md border border-sc-border-strong px-3 py-1.5 text-sc-caption text-sc-text-secondary"
                        >
                          {t('managed.backupList.verifyButton')}
                        </button>
                      </form>
                      {b.metadataStatus === 'present' && !b.metadata?.checksum && (
                        <form action={backfillChecksumAction} className="mt-2 space-y-1">
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={server.id} />
                          <input type="hidden" name="fileName" value={b.fileName} />
                          <p className="text-sc-caption text-sc-text-muted">
                            {t('managed.backupList.backfill.hint')}
                          </p>
                          <button
                            type="submit"
                            className="rounded-sc-md border border-sc-border-strong px-3 py-1.5 text-sc-caption text-sc-text-secondary"
                          >
                            {t('managed.backupList.backfill.button')}
                          </button>
                        </form>
                      )}
                      {verify === 'valid' && verifyFile === b.fileName && (
                        <form
                          method="post"
                          action={`/${locale}/servers/${server.id}/backups/download`}
                          className="mt-2 space-y-2 rounded-sc-md border border-sc-border p-2"
                        >
                          <input type="hidden" name="fileName" value={b.fileName} />
                          <ul className="space-y-1 text-sc-caption text-sc-text-muted">
                            <li>• {t('managed.backupList.download.hintSensitive')}</li>
                            <li>• {t('managed.backupList.download.hintReverify')}</li>
                            <li>• {t('managed.backupList.download.hintNoRestore')}</li>
                            <li>• {t('managed.backupList.download.hintAudited')}</li>
                          </ul>
                          <label className="flex items-start gap-2 text-sc-caption text-sc-text-secondary">
                            <input type="checkbox" name="confirmBackupContainsSensitiveData" className="mt-0.5" />
                            <span>{t('managed.backupList.download.confirmSensitiveLabel')}</span>
                          </label>
                          <label className="flex items-start gap-2 text-sc-caption text-sc-text-secondary">
                            <input type="checkbox" name="confirmSecureStorageResponsibility" className="mt-0.5" />
                            <span>{t('managed.backupList.download.confirmStorageLabel')}</span>
                          </label>
                          <div>
                            <label
                              htmlFor={`typed-${b.fileName}`}
                              className="mb-1 block text-sc-caption text-sc-text-secondary"
                            >
                              {t('managed.backupList.download.typedLabel')}
                            </label>
                            <input
                              id={`typed-${b.fileName}`}
                              name="typedConfirmation"
                              type="text"
                              autoComplete="off"
                              placeholder="DOWNLOAD BACKUP"
                              className="w-full rounded-sc-md border border-sc-border bg-sc-background px-2 py-1 text-sc-caption text-sc-text-primary outline-none focus:border-sc-primary"
                            />
                          </div>
                          <button
                            type="submit"
                            className="rounded-sc-md bg-sc-primary px-3 py-1.5 text-sc-caption font-medium text-white"
                          >
                            {t('managed.backupList.download.button')}
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {backupList && backupList.status === 'backupDirUnavailable' && (
          <p className="mt-3 text-sc-sm text-sc-warning">{t('managed.backupList.dirUnavailable')}</p>
        )}
        {backupList && backupList.status === 'unreachable' && (
          <p className="mt-3 text-sc-sm text-sc-warning">{t('managed.backupList.unreachable')}</p>
        )}
        {backupList && (backupList.status === 'error' || backupList.status === 'notManaged') && (
          <p className="mt-3 text-sc-sm text-sc-warning">{t('managed.backupList.error')}</p>
        )}
        {backupList && (
          <div className="mt-3">
            <Link
              href={`/${locale}/servers/${server.id}`}
              className="text-sc-caption text-sc-text-muted underline"
            >
              {t('managed.backupList.hideButton')}
            </Link>
          </div>
        )}
      </section>
    ) : null;

  // Archivierter managed Server (Step 027): nur Status/Info, KEINE Lifecycle-Aktionen.
  if (server.mode === 'managed' && server.archivedAt) {
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
            <h2 className="text-sc-h2 font-medium text-sc-text-primary">{t('managed.archive.title')}</h2>
            <span className="rounded-sc-sm bg-sc-surface-raised px-3 py-1 text-sc-sm font-medium text-sc-text-secondary">
              {t('managed.archive.badge')}
            </span>
          </div>
          <dl className="space-y-2 text-sc-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-sc-text-secondary">{t('managed.archive.archivedAt')}</dt>
              <dd className="text-sc-text-primary">{fmtDate(server.archivedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-sc-text-secondary">{t('managed.archive.credentials')}</dt>
              <dd className="text-sc-text-primary">
                {server.credentialsRemovedAt
                  ? t('managed.archive.credentialsRemoved')
                  : t('managed.archive.credentialsKept')}
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-sc-border pt-4 text-sc-caption text-sc-text-muted">
            {t('managed.archive.noActions')}
          </p>
        </section>
        {backupListCard}
        {exportCard}
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

  // Managed-Ansicht: vorbereitete Ressourcen, KEIN Container/Start, keine Aktionen.
  if (server.mode === 'managed') {
    const provStatus = server.provisioningStatus ?? 'DRAFT';
    const badge =
      provStatus === 'RESOURCES_PREPARED' ||
      provStatus === 'CONTAINER_CREATED' ||
      provStatus === 'RUNNING'
        ? 'bg-sc-success/15 text-sc-success'
        : provStatus === 'RESOURCE_PREPARE_PARTIAL'
          ? 'bg-sc-warning/15 text-sc-warning'
          : provStatus === 'RESOURCE_PREPARE_FAILED' || provStatus === 'ERROR'
            ? 'bg-sc-error/15 text-sc-error'
            : 'bg-sc-surface-raised text-sc-text-secondary';
    const rows: { label: string; value: string }[] = [
      { label: t('managed.network'), value: server.managedNetworkName ?? t('status.notAvailable') },
      { label: t('managed.volume'), value: server.managedVolumeName ?? t('status.notAvailable') },
      { label: t('managed.container'), value: server.managedContainerName ?? t('status.notAvailable') },
      {
        label: t('managed.queryAddress'),
        value: server.host
          ? `${server.host}:${server.queryPort ?? '—'}`
          : t('managed.queryAddressNotConfigured'),
      },
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

          {notice === 'backupCreated' && (
            <p className="mb-4 rounded-sc-sm bg-sc-success/15 px-3 py-2 text-sc-sm text-sc-success">
              {t('managed.notice.backupCreated')}
            </p>
          )}
          {notice &&
            [
              'encryptionMissing',
              'invalidState',
              'invalidPlan',
              'rateLimited',
              'credentialMissing',
              'writeDisabled',
              'unavailable',
              'unreachable',
              'conflict',
              'error',
              'licenseRequired',
              'notManaged',
              'hostInvalid',
              'hostBlocked',
              'hostRequired',
              'stillRunning',
              'stopFailed',
              'startFailed',
              'dataLossRequired',
              'backupRequired',
              'typedMismatch',
              'confirmationRequired',
              'inUseByManagedContainers',
              'archiveConfirmRequired',
              'credentialDecisionRequired',
              'sensitiveDataRequired',
              'storageRequired',
              'containerStoppedRequired',
              'containerStillExists',
              'volumeNotFound',
              'volumeNotManaged',
              'backupDirUnavailable',
              'imageUnavailable',
              'archived',
            ].includes(notice) && (
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
            {provStatus === 'RUNNING' ? (
              <>
                <p>• {t('managed.containerStartedHint')}</p>
                <p>• {t('managed.nextStepHealthcheck')}</p>
              </>
            ) : (
              <>
                {provStatus === 'CONTAINER_CREATED' ? (
                  <p>
                    •{' '}
                    {server.runState === 'stopped'
                      ? t('managed.containerStoppedHint')
                      : t('managed.containerCreatedHint')}
                  </p>
                ) : (
                  <p>• {t('managed.containerNotCreated')}</p>
                )}
                <p>• {t('managed.noServerStarted')}</p>
                {provStatus === 'RESOURCES_PREPARED' && (
                  <>
                    <p>• {t('managed.resourcesNoContainer')}</p>
                    <p>• {t('managed.prepareHintSecret')}</p>
                  </>
                )}
                {provStatus === 'CONTAINER_PENDING' && (
                  <>
                    <p>• {t('managed.createHintNotStarted')}</p>
                    <p>• {t('managed.createHintNoServer')}</p>
                    <p>• {t('managed.createHintNoSecret')}</p>
                  </>
                )}
              </>
            )}
          </div>

          <form action={updateQueryAddressAction} className="mt-4 border-t border-sc-border pt-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={server.id} />
            <label htmlFor="host" className="mb-1 block text-sc-caption text-sc-text-secondary">
              {t('managed.queryAddressLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="host"
                name="host"
                type="text"
                defaultValue={server.host ?? ''}
                placeholder="127.0.0.1"
                autoComplete="off"
                className="flex-1 rounded-sc-md border border-sc-border bg-sc-background px-3 py-1.5 text-sc-sm text-sc-text-primary outline-none focus:border-sc-primary"
              />
              <button
                type="submit"
                className="shrink-0 rounded-sc-md border border-sc-border-strong px-3 py-1.5 text-sc-sm text-sc-text-secondary"
              >
                {t('managed.queryAddressSave')}
              </button>
            </div>
            <p className="mt-1 text-sc-caption text-sc-text-muted">{t('managed.queryAddressHint')}</p>
          </form>

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

          {provStatus === 'CONTAINER_PENDING' && (
            <form action={createContainerAction} className="mt-6">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={server.id} />
              <button
                type="submit"
                className="rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white"
              >
                {t('managed.createButton')}
              </button>
            </form>
          )}

          {provStatus === 'CONTAINER_CREATED' && (
            <form action={startContainerAction} className="mt-6 space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={server.id} />
              <p className="text-sc-caption text-sc-text-muted">{t('managed.licenseHint')}</p>
              <label className="flex items-start gap-2 text-sc-sm text-sc-text-secondary">
                <input type="checkbox" name="licenseAccepted" className="mt-1" />
                <span>{t('managed.licenseLabel')}</span>
              </label>
              <button
                type="submit"
                className="rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white"
              >
                {t('managed.startButton')}
              </button>
            </form>
          )}

          {provStatus === 'CONTAINER_CREATED' && (
            <div className="mt-4 border-t border-sc-border pt-4">
              <p className="mb-2 text-sc-caption text-sc-text-muted">{t('managed.removeHintKeep')}</p>
              <RemoveContainerButton locale={locale} id={server.id} />
            </div>
          )}

          {provStatus === 'RESOURCES_PREPARED' && (
            <div className="mt-6 rounded-sc-md border border-sc-error/30 bg-sc-surface-raised p-3">
              <h3 className="text-sc-sm font-medium text-sc-error">{t('managed.dangerZone.title')}</h3>
              {server.managedVolumeState !== 'removed' && (
                <div className="mt-2 space-y-2 border-b border-sc-border pb-3">
                  <p className="text-sc-caption text-sc-text-muted">{t('managed.backup.dangerIntro')}</p>
                  <BackupVolumeButton locale={locale} id={server.id} />
                </div>
              )}
              {server.managedVolumeState === 'removed' ? (
                <p className="mt-2 text-sc-caption text-sc-text-muted">
                  • {t('managed.dangerZone.volumeRemovedHint')}
                </p>
              ) : (
                <div className="mt-2 space-y-3">
                  <p className="text-sc-caption text-sc-text-muted">{t('managed.dangerZone.intro')}</p>
                  <RemoveVolumeButton locale={locale} id={server.id} />
                </div>
              )}
              <div className="mt-3 space-y-2 border-t border-sc-border pt-3">
                <p className="text-sc-caption text-sc-text-muted">
                  {t('managed.dangerZone.networkIntro')}
                </p>
                <RemoveNetworkButton locale={locale} id={server.id} />
              </div>
              <div className="mt-3 space-y-2 border-t border-sc-border pt-3">
                <p className="text-sc-caption text-sc-text-muted">{t('managed.archive.intro')}</p>
                <ArchiveServerButton locale={locale} id={server.id} />
              </div>
            </div>
          )}

          {provStatus === 'RUNNING' && (
            <div className="mt-6 border-t border-sc-border pt-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h3 className="text-sc-sm font-medium text-sc-text-primary">
                  {t('managed.health.title')}
                </h3>
                <form action={healthcheckAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={server.id} />
                  <button
                    type="submit"
                    className="rounded-sc-md bg-sc-primary px-3 py-1.5 text-sc-sm font-medium text-white"
                  >
                    {t('managed.health.checkButton')}
                  </button>
                </form>
              </div>
              <dl className="space-y-2 text-sc-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-sc-text-secondary">{t('managed.health.containerRuntime')}</dt>
                  <dd className="font-mono text-sc-text-primary">
                    {server.containerRuntimeStatus
                      ? t(`managed.health.runtime.${server.containerRuntimeStatus}`)
                      : t('status.notAvailable')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sc-text-secondary">{t('managed.health.ts3Reachability')}</dt>
                  <dd className="font-mono text-sc-text-primary">
                    {server.ts3ReachabilityStatus
                      ? t(`managed.health.ts3.${server.ts3ReachabilityStatus}`)
                      : t('status.notAvailable')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sc-text-secondary">{t('managed.health.lastCheck')}</dt>
                  <dd className="text-sc-text-primary">{fmtDate(server.lastHealthCheckedAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sc-text-secondary">{t('managed.health.lastSuccess')}</dt>
                  <dd className="text-sc-text-primary">{fmtDate(server.lastSuccessfulHealthCheckAt)}</dd>
                </div>
                {server.ts3ReachabilityStatus === 'reachable' && (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt className="text-sc-text-secondary">{t('status.name')}</dt>
                      <dd className="text-sc-text-primary">
                        {server.statusName ?? t('status.notAvailable')}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-sc-text-secondary">{t('status.version')}</dt>
                      <dd className="text-sc-text-primary">
                        {server.statusVersion ?? t('status.notAvailable')}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-sc-text-secondary">{t('status.clients')}</dt>
                      <dd className="text-sc-text-primary">
                        {server.statusClientsOnline !== null && server.statusMaxClients !== null
                          ? `${server.statusClientsOnline} / ${server.statusMaxClients}`
                          : t('status.notAvailable')}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-sc-text-secondary">{t('status.uptime')}</dt>
                      <dd className="text-sc-text-primary">{formatUptime(server.statusUptimeSeconds)}</dd>
                    </div>
                  </>
                )}
              </dl>
              <div className="mt-3 space-y-1 text-sc-caption text-sc-text-muted">
                <p>• {t('managed.health.readonly')}</p>
                <p>• {t('managed.health.noLogs')}</p>
                <p>• {t('managed.health.noPortscan')}</p>
                <p>• {t('managed.health.noRepair')}</p>
              </div>
            </div>
          )}

          {provStatus === 'RUNNING' && (
            <div className="mt-6 space-y-4 border-t border-sc-border pt-4">
              <div>
                <StopContainerButton locale={locale} id={server.id} />
                <div className="mt-2 space-y-1 text-sc-caption text-sc-text-muted">
                  <p>• {t('managed.stopHintNoDelete')}</p>
                  <p>• {t('managed.stopHintKeepResources')}</p>
                  <p>• {t('managed.stopHintNoLogs')}</p>
                </div>
              </div>
              <div>
                <RestartContainerButton locale={locale} id={server.id} />
                <p className="mt-2 text-sc-caption text-sc-text-muted">{t('managed.restartHint')}</p>
              </div>
            </div>
          )}
        </section>

        {provStatus !== 'RESOURCES_PREPARED' && server.managedVolumeState !== 'removed' && backupInfoCard}
        {backupListCard}
        {exportCard}

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
