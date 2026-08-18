'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';
import { SHORTCUT } from '@/lib/globalShortcuts';
import { useData } from './dataContext';

const CommandPalette = dynamic(
  () => import('./CommandPalette').then((m) => m.CommandPalette),
  { ssr: false },
);

/**
 * Owns Mod+P and the palette's open state — deliberately out here rather than in the dialog.
 *
 * This component is part of the layout's static bundle, while `CommandPalette` arrives in its own
 * chunk, requested only after hydration. Binding the shortcut inside the dialog meant the first
 * press after a page load reached no listener at all and was lost without a retry. Out here the
 * press becomes state, and the dialog opens with `open` already true as soon as its chunk lands.
 */
export function CommandPaletteClient() {
  const { notes, todos } = useData();
  const [open, setOpen] = useState(false);

  useGlobalShortcut(SHORTCUT.PALETTE, () => {
    setOpen((prev) => !prev);
  });

  return <CommandPalette notes={notes} todos={todos} open={open} onOpenChange={setOpen} />;
}
