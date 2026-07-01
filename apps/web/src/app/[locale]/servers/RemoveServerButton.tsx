'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { removeServerAction } from './actions';

export function RemoveServerButton({ locale, id }: { locale: string; id: string }) {
  const t = useTranslations('servers');
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-sc-md border border-sc-error/50 px-3 py-2 text-sc-sm text-sc-error"
      >
        {t('remove')}
      </button>
    );
  }

  return (
    <form action={removeServerAction} className="flex items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <span className="text-sc-sm text-sc-text-secondary">{t('removeConfirm')}</span>
      <button
        type="submit"
        className="rounded-sc-md bg-sc-error px-3 py-2 text-sc-sm font-medium text-white"
      >
        {t('removeConfirmYes')}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
      >
        {t('removeConfirmCancel')}
      </button>
    </form>
  );
}
