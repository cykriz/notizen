"use client";

import { useEffect } from "react";
import { useData } from "@/app/(app)/DataProvider";
import { setCachedNote } from "@/lib/localCache";
import type { Note, NoteSummary } from "@/lib/types";
import { NoteEditor } from "./NoteEditor";

interface NotePageClientProps {
  note: Note | null;
  allTags: string[];
  otherNotes: NoteSummary[];
  noteId: string;
}

export function NotePageClient({
  note,
  allTags,
  otherNotes,
  noteId,
}: NotePageClientProps) {
  const { getCachedNoteContent, notes } = useData();

  const cached = getCachedNoteContent(noteId);

  const resolvedNote = (() => {
    if (note === null) {
      return cached;
    }

    if (cached === null) {
      return note;
    }

    // Prefer whichever was updated more recently
    return new Date(cached.updatedAt).getTime() > new Date(note.updatedAt).getTime() ? cached : note;
  })();

  // Cache server-provided note, but never overwrite a newer local version
  // (offline edits have a later updatedAt than stale SW-cached server HTML)
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
