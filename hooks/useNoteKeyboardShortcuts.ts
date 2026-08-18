import { useEffect } from 'react';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';
import { DEFAULT_NOTE_TITLE, PREVIEW_EDIT, PREVIEW_PREVIEW } from '@/lib/constants';
import { SHORTCUT } from '@/lib/globalShortcuts';
import type { PreviewMode } from '@/lib/types';

interface UseNoteKeyboardShortcutsOptions {
  title: string;
  preview: PreviewMode;
  setPreview: React.Dispatch<React.SetStateAction<PreviewMode>>;
  setOutlineVisible: React.Dispatch<React.SetStateAction<boolean>>;
  onRequestDelete: () => void;
}

export function useNoteKeyboardShortcuts({
  title,
  preview,
  setPreview,
  setOutlineVisible,
  onRequestDelete,
}: UseNoteKeyboardShortcutsOptions) {
  // Escape keeps its own bubble-phase listener: it is not a Mod combo, and its `preventDefault` is
  // what the second stage in useNoteSelection reads to know the key was already consumed.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        if (preview === PREVIEW_EDIT) {
          e.preventDefault();
          setPreview(PREVIEW_PREVIEW);
        } else if (title === DEFAULT_NOTE_TITLE) {
          e.preventDefault();
          onRequestDelete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [title, preview, setPreview, onRequestDelete]);

  // Both combos used to compare against 'o' while Shift was held, where KeyboardEvent.key reports
  // 'O' — so Mod+Shift+O matched neither branch and did nothing at all. The shared normalisation
  // lower-cases the key and puts Shift into the combo, which is what makes the outline reachable.
  useGlobalShortcut(SHORTCUT.OUTLINE, () => {
    setOutlineVisible((v) => !v);
  });

  useGlobalShortcut(SHORTCUT.PREVIEW, () => {
    setPreview((p) => (p === PREVIEW_EDIT ? PREVIEW_PREVIEW : PREVIEW_EDIT));
  });
}
