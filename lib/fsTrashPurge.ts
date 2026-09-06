import fs from 'fs/promises';
import type { Dirent } from 'fs';
import {
  readFrontmatterFile,
  withNoteLock,
  trashNotesDir,
  trashedNoteDir,
  trashedNoteMdPath,
} from './fsHelpers';
import { purgeExpiredTodos } from './fsTodos';
import { DAY_MS } from './constants';

/** Delete trashed notes whose trashedAt is older than retentionDays. Returns the purged note ids. */
export async function purgeExpiredNotes(root: string, retentionDays: number): Promise<string[]> {
  const cutoff = Date.now() - retentionDays * DAY_MS;
  let entries: Dirent[];
  try {
    entries = await fs.readdir(trashNotesDir(root), { withFileTypes: true });
  } catch {
    return [];
  }
  const purgedIds: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) {
      continue;
    }

    const parsed = await readFrontmatterFile(trashedNoteMdPath(e.name, root));
    const id = parsed?.data.id;
    if (typeof id !== 'string') {
      continue;
    }

    await withNoteLock(id, async () => {
      // Re-read under lock so a concurrent restore isn't clobbered.
      const p = await readFrontmatterFile(trashedNoteMdPath(e.name, root));
      const trashedAt = p?.data.trashedAt;
      if (typeof trashedAt === 'string' && new Date(trashedAt).getTime() <= cutoff) {
        await fs.rm(trashedNoteDir(e.name, root), { recursive: true, force: true });
        purgedIds.push(id);
      }
    });
  }
  return purgedIds;
}

/** Auto-purge coordinator: notes + todos older than retentionDays. */
export async function purgeExpiredTrash(
  root: string,
  retentionDays: number,
): Promise<{ noteIds: string[]; todos: number }> {
  const noteIds = await purgeExpiredNotes(root, retentionDays);
  const todos = await purgeExpiredTodos(root, retentionDays);
  return { noteIds, todos };
}
