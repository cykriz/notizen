'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Share } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_SHARE_EXPIRY, SHARE_EXPIRY_LABELS, type ShareExpiryPreset } from '@/lib/constants';
import { PRESET_KEYS } from '@/lib/shareTypes';
import { ShareNoteBody } from './ShareNoteBody';
import { useShareInfo } from './useShareInfo';

const noopUnsubscribe = () => undefined;
const noopSubscribe = () => noopUnsubscribe;
const getClientOrigin = () => window.location.origin;
const getServerOrigin = () => '';

export function ShareNoteButton({ noteId }: { noteId: string }) {
  const [open, setOpen] = useState(false);
  const [userPreset, setUserPreset] = useState<ShareExpiryPreset | null>(null);
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(noopSubscribe, getClientOrigin, getServerOrigin);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { info, fetched, pending, presetUpdated, error, create, revoke, changePreset } = useShareInfo(noteId, open);

  const preset: ShareExpiryPreset = userPreset ?? info?.preset ?? DEFAULT_SHARE_EXPIRY;

  useEffect(() => {
    return () => {
      if (copiedTimer.current) {
        clearTimeout(copiedTimer.current);
      }
    };
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setUserPreset(null);
    }
  }, []);

  const shareUrl = info && origin !== '' ? `${origin}/share/${info.token}` : '';

  const handleCreate = useCallback(() => {
    create(preset);
  }, [create, preset]);

  const handleRevoke = useCallback(() => {
    revoke();
    setCopied(false);
  }, [revoke]);

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
    // Spec types navigator.clipboard as always present, but it's undefined
    // in non-secure contexts (HTTP, older browsers).
    if (shareUrl === '' || !('clipboard' in navigator)) {
      return;
    }

    void navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        if (copiedTimer.current) {
          clearTimeout(copiedTimer.current);
        }

        copiedTimer.current = setTimeout(() => {
          setCopied(false);
          copiedTimer.current = null;
        }, 1500);
      })
      .catch(console.error);
  }, [shareUrl]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost" aria-label="Notiz teilen" className={cn({ 'bg-accent': info !== null })}>
          <Share />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={-3} className="w-80 flex flex-col gap-3">
        <PopoverArrow className="-translate-y-1/2" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Notiz teilen</p>
          <p className="text-xs text-muted-foreground">
            Öffentlicher Nur-Lese-Link. Jede Person mit diesem Link kann die Notiz ansehen.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Gültigkeit</label>
          <Select value={preset} onValueChange={handlePresetChange} disabled={pending}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {SHARE_EXPIRY_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
      </PopoverContent>
    </Popover>
  );
}
