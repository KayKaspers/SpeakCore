'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { removeContainerAction } from './actions';

/**
 * OWNER-only Remove mit deutlicher Bestätigung. Entfernt **nur** den (gestoppten) Container –
 * Volume, Network, Credentials und ServerInstance bleiben erhalten.
 */
export function RemoveContainerButton({ locale, id }: { locale: string; id: string }) {
  const t = useTranslations('servers.managed');
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-sc-md border border-sc-error/50 px-4 py-2 text-sc-sm text-sc-error"
      >
        {t('removeButton')}
      </button>
    );
  }

  return (
    <form action={removeContainerAction} className="space-y-2 rounded-sc-md border border-sc-error/40 p-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <ul className="space-y-1 text-sc-caption text-sc-text-secondary">
        <li>• {t('removeConfirm1')}</li>
        <li>• {t('removeConfirm2')}</li>
        <li>• {t('removeConfirm3')}</li>
        <li>• {t('removeConfirm4')}</li>
      </ul>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-sc-md bg-sc-error px-4 py-2 text-sc-sm font-medium text-white"
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
      </div>
    </form>
  );
}
