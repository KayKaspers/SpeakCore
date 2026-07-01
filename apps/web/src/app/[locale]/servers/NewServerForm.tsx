'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { addServerAction, type AddServerState } from './actions';

const inputClass =
  'w-full rounded-sc-md border border-sc-border bg-sc-background px-3 py-2 text-sc-body text-sc-text-primary outline-none focus:border-sc-primary';
const labelClass = 'mb-1 block text-sc-sm text-sc-text-secondary';

export function NewServerForm({ locale }: { locale: string }) {
  const t = useTranslations('servers');
  const tc = useTranslations('common');
  const [state, formAction, isPending] = useActionState<AddServerState, FormData>(addServerAction, {});

  return (
    <div className="rounded-sc-lg border border-sc-border bg-sc-surface p-6 sm:p-8">
      <h1 className="text-sc-h1 font-semibold text-sc-text-primary">{t('new.title')}</h1>
      <p className="mt-1 text-sc-sm text-sc-text-secondary">{t('new.hint')}</p>

      {state?.errorKey && (
        <p className="mt-4 rounded-sc-md bg-sc-error/15 px-4 py-3 text-sc-sm text-sc-error">
          {t(`errors.${state.errorKey}`)}
        </p>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="locale" value={locale} />

        <div>
          <label className={labelClass} htmlFor="name">
            {t('new.name')}
          </label>
          <input id="name" name="name" type="text" className={inputClass} autoComplete="off" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="host">
              {t('new.host')}
            </label>
            <input id="host" name="host" type="text" className={inputClass} autoComplete="off" />
          </div>
          <div>
            <label className={labelClass} htmlFor="queryPort">
              {t('new.queryPort')}
            </label>
            <input
              id="queryPort"
              name="queryPort"
              type="number"
              defaultValue={10011}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="voicePort">
              {t('new.voicePort')} <span className="opacity-60">({tc('optional')})</span>
            </label>
            <input
              id="voicePort"
              name="voicePort"
              type="number"
              defaultValue={9987}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="virtualServerId">
              {t('new.virtualServerId')} <span className="opacity-60">({tc('optional')})</span>
            </label>
            <input
              id="virtualServerId"
              name="virtualServerId"
              type="number"
              defaultValue={1}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="username">
              {t('new.username')}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className={inputClass}
              autoComplete="off"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="password">
              {t('new.password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className={inputClass}
              autoComplete="off"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? tc('loading') : t('new.submit')}
        </button>
      </form>
    </div>
  );
}
