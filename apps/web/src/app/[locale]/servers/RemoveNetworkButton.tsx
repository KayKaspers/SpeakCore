'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { removeNetworkAction } from './actions';

/**
 * OWNER-only Voice-Network-Löschung mit Bestätigung (`confirmNetworkUnused`). **Geteilte Ressource** –
 * nur entfernen, wenn keine managed Container mehr existieren. Kein Force, keine anderen Löschungen.
 */
export function RemoveNetworkButton({ locale, id }: { locale: string; id: string }) {
  const t = useTranslations('servers.managed.dangerZone');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sc-md border border-sc-error/50 px-4 py-2 text-sc-sm text-sc-error"
      >
        {t('networkDeleteButton')}
      </button>
    );
  }

  return (
    <form action={removeNetworkAction} className="space-y-3 rounded-sc-md border border-sc-error/40 p-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <ul className="space-y-1 text-sc-caption text-sc-text-secondary">
        <li>• {t('networkShared')}</li>
        <li>• {t('networkOnlyIfUnused')}</li>
        <li>• {t('networkOthersKept')}</li>
        <li>• {t('networkRecreatable')}</li>
      </ul>
      <label className="flex items-start gap-2 text-sc-sm text-sc-text-secondary">
        <input type="checkbox" name="confirmNetworkUnused" className="mt-1" />
        <span>{t('confirmNetworkUnusedLabel')}</span>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-sc-md bg-sc-error px-4 py-2 text-sc-sm font-medium text-white"
        >
          {t('networkDeleteConfirmYes')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('networkDeleteCancel')}
        </button>
      </div>
    </form>
  );
}
