import { useEffect } from 'react';
import { DEFAULT_NOTE_TITLE, PREVIEW_EDIT, PREVIEW_PREVIEW } from '@/lib/constants';
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

        return;
      }

      if (e.key === 'o' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setOutlineVisible((v) => !v);
        return;
      }

      if (e.key === 'o' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPreview((p) => (p === PREVIEW_EDIT ? PREVIEW_PREVIEW : PREVIEW_EDIT));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [title, preview, setPreview, setOutlineVisible, onRequestDelete]);
}
