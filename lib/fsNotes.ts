import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import matter from 'gray-matter';
import type { Note, NoteSummary } from './types';
import { listAttachments } from './fsAttachments';
import {
  NotFoundError,
  notesDir,
  noteDir,
  noteMdPath,
  attachmentsDir,
  buildSlug,
  rebuildSlug,
  ensureDir,
  readNoteFrontmatter,
  countAttachments,
  findSlugByNoteId,
  withNoteLock,
} from './fsHelpers';

export type { Note, NoteSummary, Attachment } from './types';
export { NotFoundError } from './fsHelpers';
export {
  listAttachments,
  saveAttachment,
  deleteAttachment,
  getAttachmentFilePath,
} from './fsAttachments';

function parseTags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string') : [];
}

function parsePinned(raw: unknown): boolean {
  return raw === true;
}

export async function listNotes(root: string): Promise<NoteSummary[]> {
  await ensureDir(notesDir(root));
  const entries = await fs.readdir(notesDir(root), { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  const summaries: NoteSummary[] = [];
  for (const dir of dirs) {
    const slug = dir.name;
    const parsed = await readNoteFrontmatter(slug, root);
    if (!parsed) {
      continue;
    }

    const attCount = await countAttachments(slug, root);
    summaries.push({
      id: String(parsed.data.id),
      slug,
      title: String(parsed.data.title),
      createdAt: String(parsed.data.createdAt),
      updatedAt: String(parsed.data.updatedAt),
      attachmentCount: attCount,
      tags: parseTags(parsed.data.tags),
      pinned: parsePinned(parsed.data.pinned),
    });
  }

  summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return summaries;
}

export async function getNote(id: string, root: string): Promise<Note | null> {
  const slug = await findSlugByNoteId(id, root);
  if (slug === null) {
    return null;
  }

  const parsed = await readNoteFrontmatter(slug, root);
  if (parsed === null) {
    return null;
  }

  const attachments = await listAttachments(id, root);
  return {
    id: String(parsed.data.id),
    slug,
    title: String(parsed.data.title),
    createdAt: String(parsed.data.createdAt),
    updatedAt: String(parsed.data.updatedAt),
    attachmentCount: attachments.length,
    tags: parseTags(parsed.data.tags),
    pinned: parsePinned(parsed.data.pinned),
    content: parsed.content.trim(),
    attachments,
  };
}

export async function createNote(
  input: { title: string; content: string; tags?: string[]; id?: string },
  root: string,
): Promise<Note> {
  const id = input.id ?? uuidv4();

  // If a client-provided id already exists, return the existing note (idempotent replay).
  if (input.id !== undefined) {
    const existing = await getNote(id, root);
    if (existing !== null) {
      return existing;
    }
  }

  const slug = buildSlug(input.title);
  const now = new Date().toISOString();
  const tags = input.tags ?? [];

  await ensureDir(noteDir(slug, root));
  await ensureDir(attachmentsDir(slug, root));

  const frontmatter = matter.stringify(input.content, {
    id,
    title: input.title,
    tags,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  });

  await fs.writeFile(noteMdPath(slug, root), frontmatter, 'utf-8');

  return {
    id,
    slug,
    title: input.title,
    createdAt: now,
    updatedAt: now,
    attachmentCount: 0,
    tags,
    pinned: false,
    content: input.content,
    attachments: [],
  };
}

export async function updateNote(
  id: string,
  input: { title?: string; content?: string; tags?: string[]; pinned?: boolean },
  root: string,
): Promise<Note> {
  return await withNoteLock(id, async () => {
    const existing = await getNote(id, root);
    if (!existing) {
      throw new NotFoundError(`Note not found: ${id}`);
    }

    const newTitle = input.title ?? existing.title;
    const newContent = input.content ?? existing.content;
    const newTags = input.tags ?? existing.tags;
    const newPinned = input.pinned ?? existing.pinned;
    const now = new Date().toISOString();

    let currentSlug = existing.slug;
    const titleChanged = input.title !== undefined && input.title !== existing.title;

    if (titleChanged) {
      const newSlug = rebuildSlug(existing.slug, newTitle);
      await fs.rename(noteDir(existing.slug, root), noteDir(newSlug, root));
      currentSlug = newSlug;
    }

    const frontmatter = matter.stringify(newContent, {
      id: existing.id,
      title: newTitle,
      tags: newTags,
      pinned: newPinned,
      createdAt: existing.createdAt,
      updatedAt: now,
    });

    await fs.writeFile(noteMdPath(currentSlug, root), frontmatter, 'utf-8');

    const attachments = await listAttachments(id, root);
    return {
      id: existing.id,
      slug: currentSlug,
      title: newTitle,
      createdAt: existing.createdAt,
      updatedAt: now,
      attachmentCount: attachments.length,
      tags: newTags,
      pinned: newPinned,
      content: newContent,
      attachments,
    };
  });
}

// Note: there is intentionally no hard-delete for an active note. Deleting a
// note routes through moveNoteToTrash (lib/fsTrash.ts); the trash is hard-deleted
// only from its own dir via permanentlyDeleteNote / emptyNotesTrash.

