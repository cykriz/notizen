'use client';

import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';
import { SHORTCUT } from '@/lib/globalShortcuts';
import { useData } from './dataContext';
import { paletteStore } from './paletteStore';

const CommandPalette = dynamic(
  () => import('./CommandPalette').then((m) => m.CommandPalette),
  { ssr: false },
);

/**
 * Binds Mod+P — deliberately out here rather than in the dialog.
 *
 * This component is part of the layout's static bundle, while `CommandPalette` arrives in its own
 * chunk, requested only after hydration. Binding the shortcut inside the dialog meant the first
 * press after a page load reached no listener at all and was lost without a retry. Out here the
 * press becomes state, and the dialog opens with `open` already true as soon as its chunk lands.
 * `MobileBottomNav`'s search button is in the same static bundle and gets the same guarantee.
 *
 * The state itself lives in `paletteStore` because that button is a sibling, not a child.
 */
export function CommandPaletteClient() {
  const { notes, todos } = useData();
  const open = useSyncExternalStore(
    paletteStore.subscribe,
    paletteStore.getSnapshot,
    paletteStore.getServerSnapshot,
  );

  useGlobalShortcut(SHORTCUT.PALETTE, paletteStore.toggle);

  return <CommandPalette notes={notes} todos={todos} open={open} onOpenChange={paletteStore.set} />;
}
