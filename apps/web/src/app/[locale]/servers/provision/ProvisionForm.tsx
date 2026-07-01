'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BrandMark } from '@/components/BrandMark';
import { prepareResourcesAction, type ProvisionActionState } from './actions';

const inputClass =
  'w-full rounded-sc-md border border-sc-border bg-sc-background px-3 py-2 text-sc-body text-sc-text-primary outline-none focus:border-sc-primary';
const labelClass = 'mb-1 block text-sc-sm text-sc-text-secondary';

function outcomeClass(outcome: string): string {
  return outcome === 'created' || outcome === 'exists'
    ? 'bg-sc-success/15 text-sc-success'
    : 'bg-sc-error/15 text-sc-error';
}

export function ProvisionForm({ locale }: { locale: string }) {
  const t = useTranslations('servers.provision');
  const tc = useTranslations('common');
  const [state, formAction, isPending] = useActionState<ProvisionActionState, FormData>(
    prepareResourcesAction,
    {},
  );

  const status = state.status;
  const showResources = status === 'ok' || status === 'partial' || status === 'conflict';

  return (
    <div className="rounded-sc-lg border border-sc-border bg-sc-surface p-6 sm:p-8">
      <header className="mb-4 flex items-center gap-2">
        <BrandMark className="h-7 w-7" />
        <h1 className="text-sc-h1 font-semibold text-sc-text-primary">{t('title')}</h1>
      </header>
      <p className="text-sc-sm text-sc-text-secondary">{t('intro')}</p>

      <ul className="mt-3 space-y-1 rounded-sc-md bg-sc-warning/10 px-4 py-3 text-sc-caption text-sc-warning">
        <li>• {t('warnNoContainer')}</li>
        <li>• {t('warnNoStart')}</li>
        <li>• {t('warnFlag')}</li>
      </ul>

      {state.errorKey === 'rateLimited' && (
        <p className="mt-4 rounded-sc-md bg-sc-error/15 px-4 py-3 text-sc-sm text-sc-error">
          {t('rateLimited')}
        </p>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label className={labelClass} htmlFor="displayName">
            {t('displayName')}
          </label>
          <input id="displayName" name="displayName" type="text" className={inputClass} autoComplete="off" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="voicePort">
              {t('voicePort')}
            </label>
            <input id="voicePort" name="voicePort" type="number" defaultValue={9987} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="queryPort">
              {t('queryPort')}
            </label>
            <input id="queryPort" name="queryPort" type="number" defaultValue={10011} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="fileTransferPort">
              {t('fileTransferPort')}
            </label>
            <input
              id="fileTransferPort"
              name="fileTransferPort"
              type="number"
              defaultValue={30033}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="mode">
            {t('mode')}
          </label>
          <select id="mode" name="mode" defaultValue="simple" className={inputClass}>
            <option value="simple">{t('modeSimple')}</option>
            <option value="expert">{t('modeExpert')}</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? tc('loading') : t('submit')}
        </button>
      </form>

      {status && (
        <section className="mt-6 rounded-sc-md border border-sc-border bg-sc-background p-4">
          <h2 className="mb-2 text-sc-h2 font-medium text-sc-text-primary">{t('resultTitle')}</h2>

          {status === 'writeDisabled' && (
            <p className="rounded-sc-sm bg-sc-warning/15 px-3 py-2 text-sc-sm text-sc-warning">
              {t('writeDisabledHint')}
            </p>
          )}
          {(status === 'unavailable' || status === 'unreachable') && (
            <p className="rounded-sc-sm bg-sc-warning/15 px-3 py-2 text-sc-sm text-sc-warning">
              {t('unavailableHint')}
            </p>
          )}
          {status === 'invalid' && (
            <p className="rounded-sc-sm bg-sc-error/15 px-3 py-2 text-sc-sm text-sc-error">
              {t('invalidHint')}
            </p>
          )}

          {showResources && (
            <>
              <ul className="space-y-2">
                {(state.resources ?? []).map((r) => (
                  <li key={r.kind} className="flex items-center justify-between text-sc-sm">
                    <span className="text-sc-text-primary">{t(r.kind)}</span>
                    <span
                      className={`rounded-sc-sm px-2 py-1 text-sc-caption font-medium ${outcomeClass(r.outcome)}`}
                    >
                      {t(`outcome.${r.outcome}`)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sc-caption text-sc-text-muted">{t('rollbackHint')}</p>
            </>
          )}

          <p className="mt-2 text-sc-caption text-sc-text-muted">{t('auditHint')}</p>

          {state.serverId && (
            <Link
              href={`/${locale}/servers/${state.serverId}`}
              className="mt-3 inline-block rounded-sc-md bg-sc-primary px-3 py-2 text-sc-sm font-medium text-white"
            >
              {t('viewRecord')}
            </Link>
          )}
        </section>
      )}

      <footer className="mt-6">
        <Link
          href={`/${locale}/servers`}
          className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('backToServers')}
        </Link>
      </footer>
    </div>
  );
}
