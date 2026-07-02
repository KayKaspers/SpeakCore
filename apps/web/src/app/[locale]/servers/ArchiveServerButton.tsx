'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { archiveServerAction } from './actions';

/**
 * OWNER-only ServerRecord-Archivierung mit bewusster Credential-Entscheidung + getippt `ARCHIVE SERVER`.
 * **Rein DB-seitig** – startet/stoppt/löscht keine Docker-Ressourcen. Kein Hard-Delete.
 */
export function ArchiveServerButton({ locale, id }: { locale: string; id: string }) {
  const t = useTranslations('servers.managed.archive');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sc-md border border-sc-border-strong px-4 py-2 text-sc-sm text-sc-text-secondary"
      >
        {t('archiveButton')}
      </button>
    );
  }

  return (
    <form action={archiveServerAction} className="space-y-3 rounded-sc-md border border-sc-border p-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <ul className="space-y-1 text-sc-caption text-sc-text-secondary">
        <li>• {t('hintArchived')}</li>
        <li>• {t('hintNoDocker')}</li>
        <li>• {t('hintVisible')}</li>
        <li>• {t('hintCredentials')}</li>
      </ul>
      <label className="flex items-start gap-2 text-sc-sm text-sc-text-secondary">
        <input type="checkbox" name="confirmServerRecordArchive" className="mt-1" />
        <span>{t('confirmArchiveLabel')}</span>
      </label>
      <fieldset className="space-y-1">
        <legend className="text-sc-sm text-sc-text-secondary">{t('credentialLegend')}</legend>
        <label className="flex items-center gap-2 text-sc-sm text-sc-text-secondary">
          <input type="radio" name="credentialDecision" value="keep" />
          <span>{t('credentialKeep')}</span>
        </label>
        <label className="flex items-center gap-2 text-sc-sm text-sc-text-secondary">
          <input type="radio" name="credentialDecision" value="remove" />
          <span>{t('credentialRemove')}</span>
        </label>
      </fieldset>
      <div>
        <label htmlFor="typedConfirmation" className="mb-1 block text-sc-caption text-sc-text-secondary">
          {t('typedLabel')}
        </label>
        <input
          id="typedConfirmation"
          name="typedConfirmation"
          type="text"
          autoComplete="off"
          placeholder="ARCHIVE SERVER"
          className="w-full rounded-sc-md border border-sc-border bg-sc-background px-3 py-1.5 text-sc-sm text-sc-text-primary outline-none focus:border-sc-primary"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-sc-md bg-sc-primary px-4 py-2 text-sc-sm font-medium text-white"
        >
          {t('archiveConfirmYes')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-sc-md border border-sc-border-strong px-3 py-2 text-sc-sm text-sc-text-secondary"
        >
          {t('archiveCancel')}
        </button>
      </div>
    </form>
  );
}
