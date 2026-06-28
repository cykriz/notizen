'use client';

import { useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useNavigationLoadingPending } from './navigationLoading';

const LOADING_LABEL = 'Notiz wird geladen…';
const SHOW_DELAY_MS = 120;
const TICK_MS = 400;
const FADE_MS = 300;
const START_VALUE = 10;
const CEILING = 90;
const FULL_VALUE = 100;
// Failsafe so the bar never sticks if a navigation never settles (e.g. a hung
// offline RSC request that neither resolves nor errors).
const MAX_DURATION_MS = 15000;

/**
 * Thin top "trickle" bar shown while a note navigation is pending. Climbs
 * asymptotically toward CEILING, snaps to 100% and fades out on commit. A short
 * show-delay prevents flashing on instant/cached/offline loads. No setState runs
 * synchronously in the effect body — all updates happen in timer callbacks.
 */
export function NoteLoadingBar() {
  const pending = useNavigationLoadingPending();
  const [value, setValue] = useState(0);
  const [visible, setVisible] = useState(false);

  const showDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Snap to full and fade out. Used both on commit and by the failsafe.
    const complete = () => {
      if (showDelayRef.current) {
        clearTimeout(showDelayRef.current);
        showDelayRef.current = null;
      }

      if (maxRef.current) {
        clearTimeout(maxRef.current);
        maxRef.current = null;
      }

      if (tickRef.current === null) {
        return; // Never became visible (resolved before the show-delay).
      }

      clearInterval(tickRef.current);
      tickRef.current = null;
      fadeRef.current = setTimeout(() => {
        setValue(FULL_VALUE);
        fadeRef.current = setTimeout(() => {
          fadeRef.current = null;
          setVisible(false);
          setValue(0);
        }, FADE_MS);
      }, 0);
    };

    if (pending) {
      // A new navigation started while a previous one was fading out: drop the
      // fade and reset to a clean hidden state so the next climb doesn't jump
      // backward from a leftover full value.
      if (fadeRef.current) {
        clearTimeout(fadeRef.current);
        fadeRef.current = null;
        resetRef.current = setTimeout(() => {
          resetRef.current = null;
          setVisible(false);
          setValue(0);
        }, 0);
      }

      if (showDelayRef.current === null && tickRef.current === null) {
        showDelayRef.current = setTimeout(() => {
          showDelayRef.current = null;
          setVisible(true);
          setValue(START_VALUE);
          tickRef.current = setInterval(() => {
            setValue((v) => Math.min(CEILING - 0.1, v + Math.max(1, (CEILING - v) * 0.1)));
          }, TICK_MS);
          maxRef.current = setTimeout(complete, MAX_DURATION_MS);
        }, SHOW_DELAY_MS);
      }

      return;
    }

    complete();
  }, [pending]);

  useEffect(
    () => () => {
      if (showDelayRef.current) {
        clearTimeout(showDelayRef.current);
      }

      if (tickRef.current) {
        clearInterval(tickRef.current);
      }

      if (fadeRef.current) {
        clearTimeout(fadeRef.current);
      }

      if (maxRef.current) {
        clearTimeout(maxRef.current);
      }

      if (resetRef.current) {
        clearTimeout(resetRef.current);
      }
    },
    [],
  );

  return (
    <Progress
      value={value}
      aria-label={LOADING_LABEL}
      aria-hidden={!visible}
      className={cn(
        'absolute inset-x-0 top-0 z-50 h-px rounded-none bg-transparent pointer-events-none opacity-60 transition-opacity',
        { 'opacity-0': !visible },
      )}
    />
  );
}
