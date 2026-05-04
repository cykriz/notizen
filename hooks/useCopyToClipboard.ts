'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCopyToClipboardResult {
  copiedKey: string | null;
  copy: (key: string, value: string) => Promise<boolean>;
  reset: () => void;
}

export function useCopyToClipboard(resetMs = 1500): UseCopyToClipboardResult {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (key: string, value: string): Promise<boolean> => {
      // Spec types navigator.clipboard as always present, but it's undefined
      // in non-secure contexts (HTTP, older browsers).
      if (!('clipboard' in navigator)) {
        return false;
      }

      try {
        await navigator.clipboard.writeText(value);
        setCopiedKey(key);
        if (timer.current) {
          clearTimeout(timer.current);
        }

        timer.current = setTimeout(() => {
          setCopiedKey(null);
          timer.current = null;
        }, resetMs);
        return true;
      } catch (err) {
        console.error(err);
        return false;
      }
    },
    [resetMs],
  );

  const reset = useCallback(() => {
    setCopiedKey(null);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return { copiedKey, copy, reset };
}
