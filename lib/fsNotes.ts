import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import matter from "gray-matter";
import type { Note, NoteSummary } from "./types";
import { listAttachments, saveAttachment, deleteAttachment } from "./fsAttachments";
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
      id: parsed.data.id,
      slug,
      title: parsed.data.title,
      createdAt: parsed.data.createdAt,
      updatedAt: parsed.data.updatedAt,
      attachmentCount: attCount,
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
    id: parsed.data.id,
    slug,
    title: parsed.data.title,
    createdAt: parsed.data.createdAt,
    updatedAt: parsed.data.updatedAt,
    attachmentCount: attachments.length,
    content: parsed.content.trim(),
    attachments,
  };
}

export async function createNote(input: {
  title: string;
  content: string;
}): Promise<Note> {
  const id = uuidv4();
  const slug = buildSlug(input.title);
  const now = new Date().toISOString();

  await ensureDir(noteDir(slug));
  await ensureDir(attachmentsDir(slug));

  const frontmatter = matter.stringify(input.content, {
    id,
    title: input.title,
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
    content: input.content,
    attachments: [],
  };
}

export async function updateNote(
  id: string,
  input: { title?: string; content?: string }
): Promise<Note> {
  const existing = await getNote(id);
  if (!existing) {
    throw new Error(`Note not found: ${id}`);
  }

  const newTitle = input.title ?? existing.title;
  const newContent = input.content ?? existing.content;
  const now = new Date().toISOString();

  const frontmatter = matter.stringify(newContent, {
    id: existing.id,
    title: newTitle,
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

/* eslint-disable no-console */
async function runTests() {
  const sep = "─".repeat(50);
  console.log(`\n${sep}\n  fsNotes Inline Tests\n${sep}\n`);

  const originalRoot = process.env.NOTES_ROOT;
  const testRoot = path.join(process.cwd(), `.test-notes-${String(Date.now())}`);
  process.env.NOTES_ROOT = testRoot;

  try {
    const note = await createNote({ title: "Test Note", content: "# Hello World" });
    const slugOk = /^\d{4}-\d{2}-\d{2}-test-note-[a-f0-9]+$/.test(note.slug);
    if (!slugOk) {
      throw new Error(`Bad slug: ${note.slug}`);
    }

    console.log("✓ createNote — slug, id, title correct");

    const notes = await listNotes();
    if (notes.length !== 1) {
      throw new Error(`Expected 1 note, got ${String(notes.length)}`);
    }

    console.log("✓ listNotes — found 1 note");

    const fetched = await getNote(note.id);
    if (fetched?.content !== "# Hello World") {
      throw new Error("getNote content mismatch");
    }

    console.log("✓ getNote — content matches");

    const updated = await updateNote(note.id, { title: "Updated", content: "# Updated" });
    if (updated.title !== "Updated") {
      throw new Error("Title not updated");
    }

    console.log("✓ updateNote — title and content updated");

    const att = await saveAttachment(note.id, new File(["data"], "test.txt", { type: "text/plain" }));
    console.log(`✓ saveAttachment — id: ${att.id}`);

    const atts = await listAttachments(note.id);
    if (atts.length !== 1) {
      throw new Error(`Expected 1 attachment, got ${String(atts.length)}`);
    }

    console.log("✓ listAttachments — found 1 attachment");

    await deleteAttachment(note.id, att.id);
    const attsAfter = await listAttachments(note.id);
    if (attsAfter.length !== 0) {
      throw new Error("Attachment not deleted");
    }

    console.log("✓ deleteAttachment — attachment removed");

    await deleteNote(note.id);
    const afterDelete = await listNotes();
    if (afterDelete.length !== 0) {
      throw new Error("Note not deleted");
    }

    console.log("✓ deleteNote — note removed");

    console.log(`\n${sep}\n  ALL TESTS PASSED ✓\n${sep}\n`);
  } finally {
    process.env.NOTES_ROOT = originalRoot;
    await fs.rm(testRoot, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("fsNotes.ts")) {
  runTests().catch((err: unknown) => {
    console.error("\n  TEST FAILED ✗", err);
    process.exit(1);
  });
}
