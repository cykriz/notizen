import { useMemo } from 'react';
import { PREVIEW_EDIT, PREVIEW_PREVIEW } from '@/lib/constants';
import type { Note } from '@/lib/fsNotes';
import { getCachedNote, getDraft } from '@/lib/localCache';
import type { PreviewMode } from '@/lib/types';

interface NoteInitialState {
  title: string;
  content: string;
  /** Derived from the server note alone, so it is safe for the hydration render. */
  preview: PreviewMode;
  outlineVisible: boolean;
}

/** The one place "no content yet" decides which mode a note opens in. */
export const previewModeFor = (content: string): PreviewMode =>
  content.trim() === '' ? PREVIEW_EDIT : PREVIEW_PREVIEW;

/**
 * Picks the best available content for a note on mount:
 * draft (unsaved keystrokes) > sync cache (latest save) > SSR prop (may be stale SW HTML).
 *
 * The localStorage reads run in the **hydration render** too, not just later — see
 * hooks/useClientMounted.ts. So only `title`/`content` may come from them: neither
 * reaches the server HTML (CodeMirror builds its DOM in an effect, MarkdownPreview is
 * `ssr: false`). `preview` picks the subtree that IS in the server HTML and therefore
 * comes from `note.content`; NoteEditor re-applies previewModeFor after the mount.
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
      preview: previewModeFor(note.content),
      outlineVisible: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only recalculate when the note identity or version changes, not on every object reference
  }, [note.id, note.updatedAt]);
}
