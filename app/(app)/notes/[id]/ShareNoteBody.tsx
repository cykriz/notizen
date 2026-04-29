'use client';

import { Check, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SHARE_EXPIRY_LABELS } from '@/lib/constants';
import type { ShareRecord } from '@/lib/shareTypes';

export interface ShareNoteBodyProps {
  fetched: boolean;
  info: ShareRecord | null;
  shareUrl: string;
  copied: boolean;
  pending: boolean;
  presetUpdated: boolean;
  error: string | null;
  onCopy: () => void;
  onRevoke: () => void;
  onCreate: () => void;
}

function formatExpiresAt(expiresAt: string | null): string {
  if (expiresAt === null) {
    return SHARE_EXPIRY_LABELS.never;
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(expiresAt));
}

function ErrorMessage({ error }: { error: string | null }) {
  return (
    <p className="text-xs text-destructive min-h-4" aria-live="polite" role="status">
      {error ?? ''}
    </p>
  );
}

export function ShareNoteBody({
  fetched,
  info,
  shareUrl,
  copied,
  pending,
  presetUpdated,
  error,
  onCopy,
  onRevoke,
  onCreate,
}: ShareNoteBodyProps) {
  if (!fetched) {
    return <Skeleton className="h-9 w-full" />;
  }

  if (info) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Input readOnly value={shareUrl} className="flex-1 text-xs" />
          <Button size="icon-sm" variant="outline" onClick={onCopy} aria-label="Link kopieren">
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Gültig bis: {formatExpiresAt(info.expiresAt)}</p>
        <p className="text-xs text-muted-foreground min-h-4" aria-live="polite">
          {presetUpdated ? 'Gültigkeit aktualisiert' : ''}
        </p>
        <Button variant="outline" onClick={onRevoke} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Widerrufen
        </Button>
        <ErrorMessage error={error} />
      </>
    );
  }

  return (
    <>
      <Button onClick={onCreate} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Teilen-Link erstellen
      </Button>
      <ErrorMessage error={error} />
    </>
  );
}
