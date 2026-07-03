import { updateNoteOffline, type UpdateNoteInput } from '@/lib/offlineNotes';
import type { NoteSummary } from '@/lib/types';

export interface NoteUpdate {
  id: string;
  input: UpdateNoteInput;
}

// Pure optimistic fold: applies each update's fields to the matching note, with no
// network or cache writes. Lets the UI update instantly before the (sequential,
// possibly slow online) network calls in batchUpdateNotesOffline resolve.
export function foldNoteUpdates(updates: NoteUpdate[], currentNotes: NoteSummary[]): NoteSummary[] {
  if (updates.length === 0) {
    return currentNotes;
  }

  const byId = new Map(updates.map((u) => [u.id, u.input]));
  return currentNotes.map((n) => {
    const input = byId.get(n.id);
    return input !== undefined ? { ...n, ...input } : n;
  });
}

// Folds N note updates through ONE evolving list snapshot so every change lands in a
// single setNotes/cache write — mirrors deleteTagFolderOffline. A naive loop of
// updateNote() calls reads the same stale notesRef snapshot for each iteration (the ref
// only refreshes after a React commit), so last-write-wins would keep only one change.
// Here each updateNoteOffline's internal setCachedNotesList writes a progressively
// complete list; the final write — and the returned list — contains every change.
export async function batchUpdateNotesOffline(
  updates: NoteUpdate[],
  currentNotes: NoteSummary[],
  isOnline: boolean,
): Promise<NoteSummary[]> {
  let list = currentNotes;
  for (const { id, input } of updates) {
    list = await updateNoteOffline(id, input, list, isOnline);
  }
  return list;
}
