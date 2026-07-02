'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { stopContainerAction } from './actions';

/** OWNER-only Stop mit Bestätigung. Stoppt den managed Container (kein Löschen, Daten bleiben). */
export function StopContainerButton({ locale, id }: { locale: string; id: string }) {
  const t = useTranslations('servers.managed');
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-sc-md border border-sc-border-strong px-4 py-2 text-sc-sm text-sc-text-secondary"
      >
        {t('stopButton')}
      </button>
    );
  }

  return (
    <form action={stopContainerAction} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <p className="text-sc-sm text-sc-text-secondary">{t('stopConfirm')}</p>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white"
        >
          {t('stopConfirmYes')}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('stopConfirmCancel')}
        </button>
      </div>
    </form>
  );
}
