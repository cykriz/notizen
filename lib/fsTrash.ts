import fs from 'fs/promises';
import type { Dirent } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { NoteSummary, TrashedNote } from './types';
import { DEFAULT_NOTE_TITLE } from './constants';
import {
  NotFoundError,
  notesDir,
  noteDir,
  noteMdPath,
  buildSlug,
  ensureDir,
  readNoteFrontmatter,
  readFrontmatterFile,
  parseTags,
  parsePinned,
  findSlugByNoteId,
  withNoteLock,
  trashNotesDir,
  trashedNoteDir,
  trashedNoteMdPath,
} from './fsHelpers';

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function countTrashedAttachments(slug: string, root: string): Promise<number> {
  try {
    return (await fs.readdir(path.join(trashedNoteDir(slug, root), 'attachments'))).length;
  } catch {
    return 0;
  }
}

/** Walk .trash/notes and return the slug whose note.md carries this id. */
async function findTrashedSlug(id: string, root: string): Promise<string | null> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(trashNotesDir(root), { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    if (!e.isDirectory()) {
      continue;
    }

    const parsed = await readFrontmatterFile(trashedNoteMdPath(e.name, root));
    if (parsed?.data.id === id) {
      return e.name;
    }
  }
  return null;
}

function toTrashedNote(slug: string, data: Record<string, unknown>, attachmentCount: number): TrashedNote {
  return {
    id: String(data.id),
    slug,
    title: String(data.title),
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
    attachmentCount,
    tags: parseTags(data.tags),
    pinned: parsePinned(data.pinned),
    trashedAt: String(data.trashedAt),
  } satisfies NoteSummary & { trashedAt: string };
}

/** Move an active note into the trash: stamp trashedAt, then rename its whole dir. */
export async function moveNoteToTrash(id: string, root: string): Promise<void> {
  await withNoteLock(id, async () => {
    const slug = await findSlugByNoteId(id, root);
    if (slug === null) {
      throw new NotFoundError(`Note not found: ${id}`);
    }

    const parsed = await readNoteFrontmatter(slug, root);
    if (parsed === null) {
      throw new NotFoundError(`Note not found: ${id}`);
    }

    const md = matter.stringify(parsed.content, { ...parsed.data, trashedAt: new Date().toISOString() });
    await fs.writeFile(noteMdPath(slug, root), md, 'utf-8');
    await ensureDir(trashNotesDir(root));
    await fs.rename(noteDir(slug, root), trashedNoteDir(slug, root));
  });
}

/** Restore a trashed note: strip trashedAt and rename it back into notes/. */
export async function restoreNoteFromTrash(id: string, root: string): Promise<void> {
  await withNoteLock(id, async () => {
    const slug = await findTrashedSlug(id, root);
    if (slug === null) {
      throw new NotFoundError(`Trashed note not found: ${id}`);
    }

    const parsed = await readFrontmatterFile(trashedNoteMdPath(slug, root));
    if (parsed === null) {
      throw new NotFoundError(`Trashed note not found: ${id}`);
    }

    const { trashedAt: _drop, ...data } = parsed.data;
    // Slug collision at the target (extremely unlikely) → mint a fresh slug
    // (new uuid fragment) so the rename can't clobber an existing note dir.
    const title = typeof data.title === 'string' ? data.title : DEFAULT_NOTE_TITLE;
    const targetSlug = (await pathExists(noteDir(slug, root))) ? buildSlug(title) : slug;
    await fs.writeFile(trashedNoteMdPath(slug, root), matter.stringify(parsed.content, data), 'utf-8');
    await ensureDir(notesDir(root));
    await fs.rename(trashedNoteDir(slug, root), noteDir(targetSlug, root));
  });
}

export async function permanentlyDeleteNote(id: string, root: string): Promise<void> {
  await withNoteLock(id, async () => {
    const slug = await findTrashedSlug(id, root);
    if (slug === null) {
      throw new NotFoundError(`Trashed note not found: ${id}`);
    }

    await fs.rm(trashedNoteDir(slug, root), { recursive: true, force: true });
  });
}

export async function listTrashedNotes(root: string): Promise<TrashedNote[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(trashNotesDir(root), { withFileTypes: true });
  } catch {
    return [];
  }
  const out: TrashedNote[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) {
      continue;
    }

    const parsed = await readFrontmatterFile(trashedNoteMdPath(e.name, root));
    if (parsed === null || typeof parsed.data.trashedAt !== 'string') {
      continue;
    }

    out.push(toTrashedNote(e.name, parsed.data, await countTrashedAttachments(e.name, root)));
  }
  out.sort((a, b) => new Date(b.trashedAt).getTime() - new Date(a.trashedAt).getTime());
  return out;
}

/**
 * Remove every trashed note directory. Returns the ids removed (for share
 * revocation). Deliberately a single bulk `rm` of the whole trash dir rather
 * than per-id `withNoteLock` removals — it's an explicit "empty everything"
 * action, and this app is single-user so a concurrent restore mid-empty is a
 * non-issue.
 */
export async function emptyNotesTrash(root: string): Promise<string[]> {
  const notes = await listTrashedNotes(root);
  await fs.rm(trashNotesDir(root), { recursive: true, force: true });
  return notes.map((n) => n.id);
}
