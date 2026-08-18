import { useEffect, useRef } from 'react';
import { registerShortcut, type ShortcutCombo } from '@/lib/globalShortcuts';

/**
 * Binds one of the app's global Mod+<key> shortcuts for as long as the component is mounted.
 *
 * The handler is read through a ref, so callers can pass an inline closure — and keep their guards
 * inside it — without re-registering on every render. Only the combo re-binds.
 */
export function useGlobalShortcut(combo: ShortcutCombo, handler: () => void): void {
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  useEffect(() => registerShortcut(combo, () => {
    latest.current();
  }), [combo]);
}
