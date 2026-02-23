import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import matter from "gray-matter";
import type { Note, NoteSummary } from "./types";
import { listAttachments } from "./fsAttachments";
import {
  notesDir,
  noteDir,
  noteMdPath,
  attachmentsDir,
  buildSlug,
  ensureDir,
  readNoteFrontmatter,
  countAttachments,
  findSlugByNoteId,
} from "./fsHelpers";

export type { Note, NoteSummary, Attachment } from "./types";
export { listAttachments, saveAttachment, deleteAttachment, getAttachmentFilePath } from "./fsAttachments";

function parseTags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === "string") : [];
}

function parsePinned(raw: unknown): boolean {
  return raw === true;
}

export async function listNotes(): Promise<NoteSummary[]> {
  await ensureDir(notesDir());
  const entries = await fs.readdir(notesDir(), { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  const summaries: NoteSummary[] = [];
  for (const dir of dirs) {
    const slug = dir.name;
    const parsed = await readNoteFrontmatter(slug);
    if (!parsed) {
      continue;
    }

    const attCount = await countAttachments(slug);
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

  summaries.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return summaries;
}

export async function getNote(id: string): Promise<Note | null> {
  const slug = await findSlugByNoteId(id);
  if (slug === null) {
    return null;
  }

  const parsed = await readNoteFrontmatter(slug);
  if (parsed === null) {
    return null;
  }

  const attachments = await listAttachments(id);
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

export async function createNote(input: {
  title: string;
  content: string;
  tags?: string[];
}): Promise<Note> {
  const id = uuidv4();
  const slug = buildSlug(input.title);
  const now = new Date().toISOString();
  const tags = input.tags ?? [];

  await ensureDir(noteDir(slug));
  await ensureDir(attachmentsDir(slug));

  const frontmatter = matter.stringify(input.content, {
    id,
    title: input.title,
    tags,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  });

  await fs.writeFile(noteMdPath(slug), frontmatter, "utf-8");

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
  input: { title?: string; content?: string; tags?: string[]; pinned?: boolean }
): Promise<Note> {
  const existing = await getNote(id);
  if (!existing) {
    throw new Error(`Note not found: ${id}`);
  }

  const newTitle = input.title ?? existing.title;
  const newContent = input.content ?? existing.content;
  const newTags = input.tags ?? existing.tags;
  const newPinned = input.pinned ?? existing.pinned;
  const now = new Date().toISOString();

  const frontmatter = matter.stringify(newContent, {
    id: existing.id,
    title: newTitle,
    tags: newTags,
    pinned: newPinned,
    createdAt: existing.createdAt,
    updatedAt: now,
  });

  await fs.writeFile(noteMdPath(existing.slug), frontmatter, "utf-8");

  const attachments = await listAttachments(id);
  return {
    id: existing.id,
    slug: existing.slug,
    title: newTitle,
    createdAt: existing.createdAt,
    updatedAt: now,
    attachmentCount: attachments.length,
    tags: newTags,
    pinned: newPinned,
    content: newContent,
    attachments,
  };
}

export async function deleteNote(id: string): Promise<void> {
  const existing = await getNote(id);
  if (!existing) {
    throw new Error(`Note not found: ${id}`);
  }

  await fs.rm(noteDir(existing.slug), { recursive: true, force: true });
}

export async function listAllTags(): Promise<string[]> {
  const notes = await listNotes();
  const tagSet = new Set<string>();
  for (const note of notes) {
    for (const tag of note.tags) {
      tagSet.add(tag);
    }
  }
  return [...tagSet].sort();
}

// Inline tests: run with `bun run lib/fsNotes.test.ts`
