import { deleteNoteOffline, updateNoteOffline } from '@/lib/offlineNotes';
import { getNotesUnderPath } from '@/lib/tagTree';
import type { NoteSummary } from '@/lib/types';

export function stripFolderTags(tags: string[], path: string): string[] {
  const prefix = `${path}/`;
  return tags.filter((t) => t !== path && !t.startsWith(prefix));
}

export async function deleteTagFolderOffline(
  path: string,
  currentNotes: NoteSummary[],
  isOnline: boolean,
): Promise<NoteSummary[]> {
  const affected = getNotesUnderPath(currentNotes, path);
  let list = currentNotes;
  for (const note of affected) {
    const newTags = stripFolderTags(note.tags, path);
    if (newTags.length === 0) {
      list = await deleteNoteOffline(note.id, list, isOnline);
    } else {
      list = await updateNoteOffline(note.id, { tags: newTags }, list, isOnline);
    }
  }
  return list;
}
