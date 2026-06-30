'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  PASSWORD_MIN_LENGTH,
  checkPasswordPair,
  checkPasswordStrength,
  isPlausibleEmail,
  type PasswordRule,
} from '@/core/password-policy';
import { BrandMark } from '@/components/BrandMark';
import { createOwnerAction, type SetupActionState } from './actions';

const TOTAL_STEPS = 4;
const RULES: PasswordRule[] = ['minLength', 'lowercase', 'uppercase', 'digit'];

const inputClass =
  'w-full rounded-sc-md border border-white/10 bg-sc-background px-3 py-2 text-sc-body text-sc-text-primary outline-none focus:border-sc-primary';
const labelClass = 'mb-1 block text-sc-sm text-sc-text-secondary';
const primaryBtn =
  'rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white disabled:opacity-50';
const secondaryBtn =
  'rounded-sc-md border border-white/15 px-4 py-2 text-sc-sm text-sc-text-secondary';

export function SetupWizard({ locale, locked }: { locale: string; locked: boolean }) {
  const t = useTranslations('setup');
  const tc = useTranslations('common');
  const [state, formAction, isPending] = useActionState<SetupActionState, FormData>(
    createOwnerAction,
    {},
  );

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'simple' | 'expert'>('simple');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const strength = checkPasswordStrength(password);
  const pair = checkPasswordPair(password, confirm);
  const accountValid = isPlausibleEmail(email) && pair.valid;

  return (
    <div className="rounded-sc-lg border border-white/10 bg-sc-surface p-6 sm:p-8">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <h1 className="text-sc-h1 font-semibold text-sc-text-primary">{t('title')}</h1>
        </div>
        {!locked && (
          <p className="mt-1 text-sc-caption text-sc-text-secondary">
            {t('stepOf', { current: step + 1, total: TOTAL_STEPS })}
          </p>
        )}
      </header>

      {locked ? (
        <p className="rounded-sc-md bg-sc-error/15 px-4 py-3 text-sc-sm text-sc-error">
          {t('errors.locked')}
        </p>
      ) : (
        <>
          {step === 0 && (
            <section className="space-y-4">
              <h2 className="text-sc-h2 font-medium text-sc-text-primary">{t('welcome.title')}</h2>
              <p className="text-sc-sm text-sc-text-secondary">{t('welcome.body')}</p>
              <div className="flex justify-end">
                <button type="button" className={primaryBtn} onClick={() => setStep(1)}>
                  {t('welcome.cta')}
                </button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-4">
              <h2 className="text-sc-h2 font-medium text-sc-text-primary">{t('mode.title')}</h2>
              <p className="text-sc-sm text-sc-text-secondary">{t('mode.body')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['simple', 'expert'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-sc-md border p-4 text-left ${
                      mode === m ? 'border-sc-primary bg-sc-primary/10' : 'border-white/10'
                    }`}
                  >
                    <span className="block text-sc-body font-medium text-sc-text-primary">
                      {t(`mode.${m}`)}
                    </span>
                    <span className="mt-1 block text-sc-caption text-sc-text-secondary">
                      {t(`mode.${m}Desc`)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex justify-between">
                <button type="button" className={secondaryBtn} onClick={() => setStep(0)}>
                  {tc('back')}
                </button>
                <button type="button" className={primaryBtn} onClick={() => setStep(2)}>
                  {tc('next')}
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <h2 className="text-sc-h2 font-medium text-sc-text-primary">{t('account.title')}</h2>
              <p className="text-sc-sm text-sc-text-secondary">{t('account.body')}</p>

              <div>
                <label className={labelClass} htmlFor="email">
                  {t('account.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="displayName">
                  {t('account.displayName')} <span className="opacity-60">({tc('optional')})</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  autoComplete="name"
                  className={inputClass}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="password">
                  {t('account.password')}
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="mt-1 text-sc-caption text-sc-text-secondary">
                  {t('account.passwordHint', { min: PASSWORD_MIN_LENGTH })}
                </p>
                <ul className="mt-2 space-y-1">
                  {RULES.map((rule) => {
                    const ok = !strength.failed.includes(rule);
                    return (
                      <li
                        key={rule}
                        className={`text-sc-caption ${ok ? 'text-sc-success' : 'text-sc-text-secondary'}`}
                      >
                        {ok ? '✓' : '○'} {t(`passwordRules.${rule}`, { min: PASSWORD_MIN_LENGTH })}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <label className={labelClass} htmlFor="confirm">
                  {t('account.confirm')}
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {confirm.length > 0 && pair.mismatch && (
                  <p className="mt-1 text-sc-caption text-sc-error">{t('errors.passwordMismatch')}</p>
                )}
              </div>

              <div className="flex justify-between">
                <button type="button" className={secondaryBtn} onClick={() => setStep(1)}>
                  {tc('back')}
                </button>
                <button
                  type="button"
                  className={primaryBtn}
                  disabled={!accountValid}
                  onClick={() => setStep(3)}
                >
                  {tc('next')}
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4">
              <h2 className="text-sc-h2 font-medium text-sc-text-primary">{t('summary.title')}</h2>
              <p className="text-sc-sm text-sc-text-secondary">{t('summary.body')}</p>

              <dl className="space-y-2 rounded-sc-md border border-white/10 bg-sc-background p-4 text-sc-sm">
                <div className="flex justify-between">
                  <dt className="text-sc-text-secondary">{t('summary.modeLabel')}</dt>
                  <dd className="text-sc-text-primary">{t(`mode.${mode}`)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sc-text-secondary">{t('summary.emailLabel')}</dt>
                  <dd className="text-sc-text-primary">{email}</dd>
                </div>
                {displayName.trim() && (
                  <div className="flex justify-between">
                    <dt className="text-sc-text-secondary">{t('summary.displayNameLabel')}</dt>
                    <dd className="text-sc-text-primary">{displayName}</dd>
                  </div>
                )}
              </dl>

              {state?.errorKey && (
                <p className="rounded-sc-md bg-sc-error/15 px-4 py-3 text-sc-sm text-sc-error">
                  {t(`errors.${state.errorKey}`)}
                </p>
              )}

              <form action={formAction} className="flex justify-between">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="mode" value={mode} />
                <input type="hidden" name="email" value={email} />
                <input type="hidden" name="displayName" value={displayName} />
                <input type="hidden" name="password" value={password} />
                <input type="hidden" name="confirm" value={confirm} />
                <button type="button" className={secondaryBtn} onClick={() => setStep(2)}>
                  {tc('back')}
                </button>
                <button type="submit" className={primaryBtn} disabled={isPending}>
                  {isPending ? tc('loading') : t('summary.create')}
                </button>
              </form>
            </section>
          )}
        </>
      )}
    </div>
  );
}
