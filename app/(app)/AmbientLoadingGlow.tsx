'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useLoadingPulseTick, useNavigationLoadingPending } from './navigationLoading';

// Cached note navigations settle in a few milliseconds — far shorter than the fade-in — so
// every pending start holds the glow for at least this long, or it would never show.
const MIN_VISIBLE_MS = 1600;

/**
 * Hidden loading indicator: a second colour orbits the corner glow while a navigation is
 * pending, and for one hold after each pulse (e.g. a todo change).
 */
export function AmbientLoadingGlow() {
  const pending = useNavigationLoadingPending();
  const tick = useLoadingPulseTick();
  const [holding, setHolding] = useState(false);
  const showRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timers are deliberately not cleared when `pending` drops: the hold must outlive it.
  const startHold = useCallback(() => {
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
  }, []);

  useEffect(() => {
    if (pending) {
      startHold();
    }
  }, [pending, startHold]);

  useEffect(() => {
    if (tick > 0) {
      startHold();
    }
  }, [tick, startHold]);

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
