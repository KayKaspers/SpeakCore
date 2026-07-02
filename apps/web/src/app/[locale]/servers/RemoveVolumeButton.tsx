'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { removeVolumeAction } from './actions';

/**
 * OWNER-only Volume-Löschung mit **Doppelbestätigung** (Datenverlust + Backup + getippt `DELETE VOLUME`).
 * **Datenverlust!** Kein Vorab-Default, keine vorausgefüllte getippte Bestätigung.
 */
export function RemoveVolumeButton({ locale, id }: { locale: string; id: string }) {
  const t = useTranslations('servers.managed.dangerZone');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sc-md border border-sc-error/50 px-4 py-2 text-sc-sm text-sc-error"
      >
        {t('volumeDeleteButton')}
      </button>
    );
  }

  return (
    <form action={removeVolumeAction} className="space-y-3 rounded-sc-md border border-sc-error/40 p-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <ul className="space-y-1 text-sc-caption text-sc-error">
        <li>• {t('warnData')}</li>
        <li>• {t('warnIrreversible')}</li>
        <li>• {t('warnBackup')}</li>
        <li>• {t('warnContainerFirst')}</li>
        <li>• {t('warnOthersKept')}</li>
      </ul>
      <label className="flex items-start gap-2 text-sc-sm text-sc-text-secondary">
        <input type="checkbox" name="confirmVolumeDataLoss" className="mt-1" />
        <span>{t('confirmDataLossLabel')}</span>
      </label>
      <label className="flex items-start gap-2 text-sc-sm text-sc-text-secondary">
        <input type="checkbox" name="confirmBackupRecommended" className="mt-1" />
        <span>{t('confirmBackupLabel')}</span>
      </label>
      <div>
        <label htmlFor="typedConfirmation" className="mb-1 block text-sc-caption text-sc-text-secondary">
          {t('typedLabel')}
        </label>
        <input
          id="typedConfirmation"
          name="typedConfirmation"
          type="text"
          autoComplete="off"
          placeholder="DELETE VOLUME"
          className="w-full rounded-sc-md border border-sc-border bg-sc-background px-3 py-1.5 text-sc-sm text-sc-text-primary outline-none focus:border-sc-error"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-sc-md bg-sc-error px-4 py-2 text-sc-sm font-medium text-white"
        >
          {t('volumeDeleteConfirmYes')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('volumeDeleteCancel')}
        </button>
      </div>
    </form>
  );
}
