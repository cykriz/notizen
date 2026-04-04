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
  if (!note || note.tags.length === 0) {
    return '';
  }

  return note.tags[0];
}
