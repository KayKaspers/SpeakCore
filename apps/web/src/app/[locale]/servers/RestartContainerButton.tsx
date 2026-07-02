'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { restartContainerAction } from './actions';

/**
 * OWNER-only Restart mit Bestätigung + **erneuter Lizenz-Checkbox**. Orchestriert Stop→Start
 * (kein `docker restart`, keine Löschung, keine Logs).
 */
export function RestartContainerButton({ locale, id }: { locale: string; id: string }) {
  const t = useTranslations('servers.managed');
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-sc-md border border-sc-border-strong px-4 py-2 text-sc-sm text-sc-text-secondary"
      >
        {t('restartButton')}
      </button>
    );
  }

  return (
    <form action={restartContainerAction} className="space-y-3 rounded-sc-md border border-sc-border p-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <ul className="space-y-1 text-sc-caption text-sc-text-secondary">
        <li>• {t('restartConfirm1')}</li>
        <li>• {t('restartConfirm2')}</li>
        <li>• {t('restartConfirm3')}</li>
      </ul>
      <label className="flex items-start gap-2 text-sc-sm text-sc-text-secondary">
        <input type="checkbox" name="licenseAccepted" className="mt-1" />
        <span>{t('restartLicenseLabel')}</span>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white"
        >
          {t('restartConfirmYes')}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('restartConfirmCancel')}
        </button>
      </div>
    </form>
  );
}
