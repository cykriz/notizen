'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useNavigationLoadingPending } from './navigationLoading';

// Cached note navigations settle in a few milliseconds — far shorter than the fade-in — so
// every pending start holds the glow for at least this long, or it would never show.
const MIN_VISIBLE_MS = 1600;

/** Hidden loading indicator: a second colour orbits the corner glow while a navigation is pending. */
export function AmbientLoadingGlow() {
  const pending = useNavigationLoadingPending();
  const [holding, setHolding] = useState(false);
  const showRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pending) {
      return;
    }

    // Timers are deliberately not cleared when `pending` drops: the hold must outlive it.
    if (hideRef.current) {
      clearTimeout(hideRef.current);
    }

    showRef.current = setTimeout(() => {
      setHolding(true);
    }, 0);
    hideRef.current = setTimeout(() => {
      hideRef.current = null;
      setHolding(false);
    }, MIN_VISIBLE_MS);
  }, [pending]);

  useEffect(
    () => () => {
      if (showRef.current) {
        clearTimeout(showRef.current);
      }

      if (hideRef.current) {
        clearTimeout(hideRef.current);
      }
    },
    [],
  );

  return <div aria-hidden className={cn('ambient-loading-glow', { 'is-active': pending || holding })} />;
}
