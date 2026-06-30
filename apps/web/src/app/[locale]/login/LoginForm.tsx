'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { loginAction, type LoginActionState } from './actions';

const inputClass =
  'w-full rounded-sc-md border border-white/10 bg-sc-background px-3 py-2 text-sc-body text-sc-text-primary outline-none focus:border-sc-primary';
const labelClass = 'mb-1 block text-sc-sm text-sc-text-secondary';

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations('login');
  const [state, formAction, isPending] = useActionState<LoginActionState, FormData>(loginAction, {});

  return (
    <div className="rounded-sc-lg border border-white/10 bg-sc-surface p-6 sm:p-8">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-sc-accent" aria-hidden />
          <h1 className="text-sc-h1 font-semibold text-sc-text-primary">{t('title')}</h1>
        </div>
        <p className="mt-1 text-sc-sm text-sc-text-secondary">{t('body')}</p>
      </header>

      {state?.errorKey && (
        <p className="mb-4 rounded-sc-md bg-sc-error/15 px-4 py-3 text-sc-sm text-sc-error">
          {t(state.errorKey)}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label className={labelClass} htmlFor="email">
            {t('email')}
          </label>
          <input id="email" name="email" type="email" autoComplete="email" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            {t('password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white disabled:opacity-50"
        >
          {t('submit')}
        </button>
      </form>
    </div>
  );
}
