'use client';

import { Check, Loader2 } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface SaveIndicatorProps {
  saving: boolean;
  saved: boolean;
}

export const SaveIndicator = memo(function SaveIndicator({ saving, saved }: SaveIndicatorProps) {
  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'pointer-events-none absolute top-2 right-2 z-10 inline-flex size-4 items-center justify-center text-muted-foreground/70 transition-opacity',
        { 'opacity-0': !saving && !saved },
      )}
    >
      {saving && (
        <>
          <Loader2 className="size-3 animate-spin" aria-hidden />
          <span className="sr-only">Speichern…</span>
        </>
      )}
      {!saving && saved && (
        <>
          <Check className="size-3" aria-hidden />
          <span className="sr-only">Gespeichert</span>
        </>
      )}
    </span>
  );
});
