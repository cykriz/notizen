import type { NoteSummary } from '@/lib/types';

/** Extracts note ID from URL pathname; matches "/notes/<id>" but not nested paths */
export function extractNoteId(pathname: string): string | null {
  return /^\/notes\/([^/]+)$/.exec(pathname)?.[1] ?? null;
}

export function getNoteTagPath(notes: NoteSummary[], pathname: string): string {
  const id = extractNoteId(pathname);
  if (id === null) {
    return '';
  }

  const note = notes.find((n) => n.id === id);
  return note ? noteTagPath(note) : '';
}

/** The folder a note lives in by default: its first tag, or root when it has none. */
export function noteTagPath(note: NoteSummary): string {
  return note.tags.length > 0 ? note.tags[0] : '';
}
