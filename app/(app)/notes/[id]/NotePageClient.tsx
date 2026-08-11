'use client';

import { useEffect, useReducer, useState } from 'react';
import { useData } from '@/app/(app)/dataContext';
import { OFFLINE_SHELL_ID } from '@/lib/constants';
import { NOTES_PATH_PREFIX } from '@/lib/pathConstants';
import { setCachedNote } from '@/lib/localCache';
import { warmPageCache } from '@/lib/warmPageCache';
import type { Note } from '@/lib/types';
import { NoteEditor } from './NoteEditor';

interface NotePageClientProps {
  note: Note | null;
  noteId: string;
}

// The SW may serve a generic note-detail "shell" document (server-rendered with
// note=null under the reserved OFFLINE_SHELL_ID) for an offline navigation to a
// note whose own HTML was never cached — e.g. notes created offline. In that
// case the server `noteId` prop is the shell's reserved id, not the note the
// user opened. The real id lives in the address bar, so after mount we read it
// from there and treat it as the source of truth for cache lookups.
function readUrlNoteId(fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const match = /\/notes\/([^/]+)/.exec(window.location.pathname);
  return match?.[1] ?? fallback;
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
  noteId,
}: NotePageClientProps) {
  const { getCachedNoteContent, notes } = useData();

  // First render uses the server `noteId` so SSR and hydration always match.
  // After mount we reconcile against the address bar: for a shell-served page
  // the URL id differs from the reserved prop and becomes the effective id.
  const [resolvedId, setResolvedId] = useState(noteId);
  useEffect(() => {
    setResolvedId(readUrlNoteId(noteId));
  }, [noteId]);

  // First render uses the server `note` so SSR and hydration always match.
  // After mount, the effect checks localStorage for a newer version (offline
  // edits saved while the SW served stale HTML) and swaps it in via dispatch.
  const [resolvedNote, applyCache] = useReducer(cacheReducer, note);

  useEffect(() => {
    const cached = getCachedNoteContent(resolvedId);
    if (cached !== null) {
      applyCache(cached);
    }
  }, [resolvedId, getCachedNoteContent]);

  // Cache the server-provided note for offline access, but never overwrite a
  // newer local version (offline edits have a later updatedAt).
  useEffect(() => {
    if (note === null) {
      return;
    }

    const local = getCachedNoteContent(resolvedId);
    if (local === null || new Date(note.updatedAt).getTime() >= new Date(local.updatedAt).getTime()) {
      setCachedNote(note);
    }
  }, [note, resolvedId, getCachedNoteContent]);

  // Warm pages-v2 with the real HTML for this URL so a future offline
  // cold-load hits a genuine cached page (not the standalone /offline).
  // Separated into own effect: only fire on id change, not on every edit.
  useEffect(() => {
    warmPageCache(`${NOTES_PATH_PREFIX}${resolvedId}`);
  }, [resolvedId]);

  // SW-served generic shell: until the post-mount effect resolves the real id
  // from the URL, the reserved id is all we have. Render a neutral, content-free
  // placeholder so the server HTML and the first client render are identical no
  // matter which note URL the shell was served under — avoids a hydration
  // mismatch (React #418) from the page subtree.
  if (resolvedId === OFFLINE_SHELL_ID) {
    return <div className="flex flex-1" aria-hidden />;
  }

  if (resolvedNote === null) {
    // If the id is in the cached sidebar list, the note exists but hasn't
    // been opened (and therefore cached) yet — distinguish that from a
    // genuinely-missing id.
    const isKnownNote = notes.some((n) => n.id === resolvedId);
    const message = isKnownNote
      ? 'Diese Notiz wurde noch nicht für die Offline-Nutzung zwischengespeichert.'
      : 'Notiz nicht gefunden';
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-muted-foreground">
        {message}
      </div>
    );
  }

  // Always derive from the reactive `notes` state (seeded by the layout's
  // server listNotes(), then kept in sync by client mutations). Using static
  // server props here would freeze the tag suggestions / note links, so a
  // deleted tag would linger in the dropdown.
  const effectiveTags = [...new Set(notes.flatMap((n) => n.tags))].sort();
  const effectiveOtherNotes = notes.filter((n) => n.id !== resolvedId);

  return (
    <NoteEditor
      key={resolvedNote.id}
      note={resolvedNote}
      allTags={effectiveTags}
      notes={effectiveOtherNotes}
    />
  );
}
