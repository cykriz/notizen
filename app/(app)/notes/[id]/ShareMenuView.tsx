'use client';

import { useCallback, useState } from 'react';
import { DEFAULT_SHARE_EXPIRY, SHARE_EXPIRY_LABELS, type ShareExpiryPreset } from '@/lib/constants';
import { buildShareUrl } from '@/lib/shareFormat';
import { PRESET_KEYS } from '@/lib/shareTypes';
import { useClientMounted } from '@/hooks/useClientMounted';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { LabeledSelect } from '@/components/LabeledSelect';
import { ShareNoteBody } from './ShareNoteBody';
import { useShareInfo } from './useShareInfo';

const COPY_KEY = 'share-link';

// The share panel shown inside the note actions menu. It only mounts while the
// share view is open, so it fetches on mount and resets naturally on unmount
// (the menu unmounts it when navigating back or closing the popover).
export function ShareMenuView({ noteId }: { noteId: string }) {
  const [userPreset, setUserPreset] = useState<ShareExpiryPreset | null>(null);
  const origin = useClientMounted() ? window.location.origin : '';
  const { copiedKey, copy, reset: resetCopied } = useCopyToClipboard();
  const copied = copiedKey === COPY_KEY;

  const { info, fetched, pending, presetUpdated, error, create, revoke, changePreset } = useShareInfo(noteId);

  const preset: ShareExpiryPreset = userPreset ?? info?.preset ?? DEFAULT_SHARE_EXPIRY;
  const shareUrl = info && origin !== '' ? buildShareUrl(origin, info.token) : '';

  const handleCreate = useCallback(() => {
    create(preset);
  }, [create, preset]);

  const handleRevoke = useCallback(() => {
    revoke();
    resetCopied();
  }, [revoke, resetCopied]);

  const handlePresetChange = useCallback(
    (value: string) => {
      const next = value as ShareExpiryPreset;
      setUserPreset(next);
      if (info) {
        changePreset(next);
      }
    },
    [changePreset, info],
  );

  const handleCopy = useCallback(() => {
    if (shareUrl === '') {
      return;
    }

    void copy(COPY_KEY, shareUrl);
  }, [copy, shareUrl]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Notiz teilen</p>
        <p className="text-xs text-muted-foreground">
          Öffentlicher Nur-Lese-Link. Jede Person mit diesem Link kann die Notiz ansehen.
        </p>
      </div>

      <LabeledSelect
        label="Gültigkeit"
        value={preset}
        options={PRESET_KEYS.map((key) => ({ value: key, label: SHARE_EXPIRY_LABELS[key] }))}
        onChange={handlePresetChange}
        disabled={pending}
      />

      <ShareNoteBody
        fetched={fetched}
        info={info}
        shareUrl={shareUrl}
        copied={copied}
        pending={pending}
        presetUpdated={presetUpdated}
        error={error}
        onCopy={handleCopy}
        onRevoke={handleRevoke}
        onCreate={handleCreate}
      />
    </div>
  );
}
