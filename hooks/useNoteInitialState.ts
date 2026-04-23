import { useMemo } from 'react';
import { PREVIEW_EDIT, PREVIEW_PREVIEW } from '@/lib/constants';
import type { Note } from '@/lib/fsNotes';
import { getCachedNote, getDraft } from '@/lib/localCache';
import type { PreviewMode } from '@/lib/types';

interface NoteInitialState {
  title: string;
  content: string;
  preview: PreviewMode;
  outlineVisible: boolean;
}

/**
 * Picks the best available content for a note on mount:
 * draft (unsaved keystrokes) > sync cache (latest save) > SSR prop (may be stale SW HTML).
 *
 * Safe to call in a "use client" component — localStorage reads happen client-side only.
 */
export function useNoteInitialState(note: Note): NoteInitialState {
  return useMemo(() => {
    const cached = getCachedNote(note.id);
    const base =
      cached !== null && new Date(cached.updatedAt).getTime() > new Date(note.updatedAt).getTime() ? cached : note;
    const draft = getDraft(note.id);
    const best = draft !== null ? { ...base, title: draft.title, content: draft.content } : base;

    return {
      title: best.title,
      content: best.content,
      preview: best.content.trim() === '' ? PREVIEW_EDIT : PREVIEW_PREVIEW,
      outlineVisible: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only recalculate when the note identity or version changes, not on every object reference
  }, [note.id, note.updatedAt]);
}
