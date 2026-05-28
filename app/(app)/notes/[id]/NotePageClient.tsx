'use client';

import { useEffect, useReducer } from 'react';
import { useData } from '@/app/(app)/dataContext';
import { setCachedNote } from '@/lib/localCache';
import type { Note, NoteSummary } from '@/lib/types';
import { NoteEditor } from './NoteEditor';

interface NotePageClientProps {
  note: Note | null;
  allTags: string[];
  otherNotes: NoteSummary[];
  noteId: string;
}

function cacheReducer(state: Note | null, cached: Note): Note | null {
  // Only swap when the cached version is genuinely newer (offline edits).
  if (state !== null && new Date(cached.updatedAt).getTime() <= new Date(state.updatedAt).getTime()) {
    return state;
  }

  return cached;
}

export function NotePageClient({
  note,
  allTags,
  otherNotes,
  noteId,
}: NotePageClientProps) {
  const { getCachedNoteContent, notes } = useData();

  // First render uses the server `note` so SSR and hydration always match.
  // After mount, the effect checks localStorage for a newer version (offline
  // edits saved while the SW served stale HTML) and swaps it in via dispatch.
  const [resolvedNote, applyCache] = useReducer(cacheReducer, note);

  useEffect(() => {
    const cached = getCachedNoteContent(noteId);
    if (cached !== null) {
      applyCache(cached);
    }
  }, [noteId, getCachedNoteContent]);

  // Cache the server-provided note for offline access, but never overwrite a
  // newer local version (offline edits have a later updatedAt).
  useEffect(() => {
    if (note === null) {
      return;
    }

    const local = getCachedNoteContent(noteId);
    if (local === null || new Date(note.updatedAt).getTime() >= new Date(local.updatedAt).getTime()) {
      setCachedNote(note);
    }
  }, [note, noteId, getCachedNoteContent]);

  if (resolvedNote === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Notiz nicht gefunden
      </div>
    );
  }

  const serverDataAvailable = note !== null;

  const effectiveTags = serverDataAvailable
    ? allTags
    : [...new Set(notes.flatMap((n) => n.tags))].sort();

  const effectiveOtherNotes = serverDataAvailable
    ? otherNotes
    : notes.filter((n) => n.id !== noteId);

  return (
    <NoteEditor
      key={resolvedNote.id}
      note={resolvedNote}
      allTags={effectiveTags}
      notes={effectiveOtherNotes}
    />
  );
}
