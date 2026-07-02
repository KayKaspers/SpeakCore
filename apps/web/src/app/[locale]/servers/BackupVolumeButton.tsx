'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { backupVolumeAction } from './actions';

/**
 * OWNER-only Volume-Backup mit Bestätigungen (sensible Daten + Aufbewahrung + Container gestoppt) und
 * getippt `CREATE BACKUP`. **Backup-Datei ist potenziell sensibel.** Kein Download/Restore in diesem Step.
 */
export function BackupVolumeButton({ locale, id }: { locale: string; id: string }) {
  const t = useTranslations('servers.managed.backup');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sc-md border border-sc-border-strong px-4 py-2 text-sc-sm text-sc-text-secondary"
      >
        {t('createButton')}
      </button>
    );
  }

  return (
    <form action={backupVolumeAction} className="space-y-3 rounded-sc-md border border-sc-border p-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <ul className="space-y-1 text-sc-caption text-sc-text-secondary">
        <li>• {t('hintDataBackup')}</li>
        <li>• {t('hintSensitive')}</li>
        <li>• {t('hintNoRestore')}</li>
        <li>• {t('hintServerSide')}</li>
      </ul>
      <label className="flex items-start gap-2 text-sc-sm text-sc-text-secondary">
        <input type="checkbox" name="confirmBackupMayContainSensitiveData" className="mt-1" />
        <span>{t('confirmSensitiveLabel')}</span>
      </label>
      <label className="flex items-start gap-2 text-sc-sm text-sc-text-secondary">
        <input type="checkbox" name="confirmBackupStorageResponsibility" className="mt-1" />
        <span>{t('confirmStorageLabel')}</span>
      </label>
      <label className="flex items-start gap-2 text-sc-sm text-sc-text-secondary">
        <input type="checkbox" name="confirmContainerShouldBeStopped" className="mt-1" />
        <span>{t('confirmStoppedLabel')}</span>
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
          placeholder="CREATE BACKUP"
          className="w-full rounded-sc-md border border-sc-border bg-sc-background px-3 py-1.5 text-sc-sm text-sc-text-primary outline-none focus:border-sc-primary"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white"
        >
          {t('createConfirmYes')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('createCancel')}
        </button>
      </div>
    </form>
  );
}
