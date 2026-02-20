import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import matter from "gray-matter";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface NoteSummary {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  relativePath: string;
}

export interface Note extends NoteSummary {
  content: string;
  attachments: Attachment[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNotesRoot(): string {
  const root = process.env.NOTES_ROOT;
  return root !== undefined && root !== "" ? root : path.join(process.cwd(), "dev-notes");
}

function notesDir(): string {
  return path.join(getNotesRoot(), "notes");
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildSlug(title: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const id = uuidv4().split("-")[0];
  return `${date}-${slugify(title)}-${id}`;
}

function noteDir(slug: string): string {
  return path.join(notesDir(), slug);
}

function noteMdPath(slug: string): string {
  return path.join(noteDir(slug), "note.md");
}

function attachmentsDir(slug: string): string {
  return path.join(noteDir(slug), "attachments");
}

function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
  };
  return map[ext] ?? "application/octet-stream";
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readNoteFrontmatter(
  slug: string
): Promise<{ data: Record<string, string>; content: string } | null> {
  try {
    const raw = await fs.readFile(noteMdPath(slug), "utf-8");
    const parsed = matter(raw);
    return { data: parsed.data as Record<string, string>, content: parsed.content };
  } catch {
    return null;
  }
}

async function countAttachments(slug: string): Promise<number> {
  try {
    const entries = await fs.readdir(attachmentsDir(slug));
    return entries.length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

export async function listNotes(): Promise<NoteSummary[]> {
  await ensureDir(notesDir());
  const entries = await fs.readdir(notesDir(), { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  const summaries: NoteSummary[] = [];
  for (const dir of dirs) {
    const slug = dir.name;
    const parsed = await readNoteFrontmatter(slug);
    if (!parsed) {continue;}

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
  await ensureDir(notesDir());
  const entries = await fs.readdir(notesDir(), { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  for (const dir of dirs) {
    const slug = dir.name;
    const parsed = await readNoteFrontmatter(slug);
    if (parsed?.data.id !== id) {continue;}

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

  return null;
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
  if (!existing) {throw new Error(`Note not found: ${id}`);}

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
  if (!existing) {throw new Error(`Note not found: ${id}`);}
  await fs.rm(noteDir(existing.slug), { recursive: true, force: true });
}

export async function listAttachments(noteId: string): Promise<Attachment[]> {
  await ensureDir(notesDir());
  const entries = await fs.readdir(notesDir(), { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  for (const dir of dirs) {
    const slug = dir.name;
    const parsed = await readNoteFrontmatter(slug);
    if (parsed?.data.id !== noteId) {continue;}

    const attDir = attachmentsDir(slug);
    try {
      const files = await fs.readdir(attDir);
      const attachments: Attachment[] = [];

      for (const file of files) {
        const filePath = path.join(attDir, file);
        const stat = await fs.stat(filePath);
        const parts = file.split("_", 2);
        const attId = parts[0];
        const originalName = parts.length > 1 ? parts[1] : file;

        attachments.push({
          id: attId,
          originalName,
          mimeType: guessMimeType(originalName),
          size: stat.size,
          relativePath: `attachments/${file}`,
        });
      }

      return attachments;
    } catch {
      return [];
    }
  }

  return [];
}

export async function saveAttachment(
  noteId: string,
  file: File
): Promise<Attachment> {
  const existing = await getNote(noteId);
  if (!existing) {throw new Error(`Note not found: ${noteId}`);}

  const attId = uuidv4().split("-")[0];
  const storedName = `${attId}_${file.name}`;
  const attDir = attachmentsDir(existing.slug);
  await ensureDir(attDir);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(attDir, storedName), buffer);

  return {
    id: attId,
    originalName: file.name,
    mimeType: file.type !== "" ? file.type : guessMimeType(file.name),
    size: file.size,
    relativePath: `attachments/${storedName}`,
  };
}

export async function deleteAttachment(
  noteId: string,
  attId: string
): Promise<void> {
  const existing = await getNote(noteId);
  if (!existing) {throw new Error(`Note not found: ${noteId}`);}

  const attDir = attachmentsDir(existing.slug);
  let files: string[];
  try {
    files = await fs.readdir(attDir);
  } catch {
    throw new Error(`Attachment not found: ${attId}`);
  }
  const target = files.find((f) => f.startsWith(`${attId}_`));
  if (target === undefined) {throw new Error(`Attachment not found: ${attId}`);}

  await fs.rm(path.join(attDir, target));
}

// ---------------------------------------------------------------------------
// Inline Tests (run with: bun lib/fsNotes.ts)
// ---------------------------------------------------------------------------

/* eslint-disable no-console */
async function runTests() {
  const sep = "─".repeat(50);
  console.log(`\n${sep}`);
  console.log("  fsNotes Inline Tests");
  console.log(`${sep}\n`);

  const originalRoot = process.env.NOTES_ROOT;
  const testRoot = path.join(process.cwd(), `.test-notes-${String(Date.now())}`);
  process.env.NOTES_ROOT = testRoot;

  try {
    // Test 1: createNote
    console.log("1) createNote...");
    const note = await createNote({ title: "Test Note", content: "# Hello World" });
    console.log(`   ✓ Created: ${note.slug}`);
    console.log(`   ✓ ID: ${note.id}`);
    console.log(`   ✓ Title: ${note.title}`);
    const slugPattern = /^\d{4}-\d{2}-\d{2}-test-note-[a-f0-9]+$/;
    if (!slugPattern.test(note.slug)) {throw new Error(`Bad slug: ${note.slug}`);}
    console.log("   ✓ Slug pattern valid");

    // Verify FS
    const mdExists = await fs.stat(noteMdPath(note.slug)).then(() => true).catch(() => false);
    if (!mdExists) {throw new Error("note.md not created");}
    console.log("   ✓ note.md exists on disk");

    const attDirExists = await fs.stat(attachmentsDir(note.slug)).then(() => true).catch(() => false);
    if (!attDirExists) {throw new Error("attachments/ not created");}
    console.log("   ✓ attachments/ dir exists");

    // Test 2: listNotes
    console.log("\n2) listNotes...");
    const notes = await listNotes();
    if (notes.length !== 1) {throw new Error(`Expected 1 note, got ${String(notes.length)}`);}
    console.log(`   ✓ Found ${String(notes.length)} note(s)`);

    // Test 3: getNote
    console.log("\n3) getNote...");
    const fetched = await getNote(note.id);
    if (!fetched) {throw new Error("getNote returned null");}
    if (fetched.content !== "# Hello World") {throw new Error(`Bad content: ${fetched.content}`);}
    console.log(`   ✓ Content matches`);

    // Test 4: updateNote
    console.log("\n4) updateNote...");
    const updated = await updateNote(note.id, { title: "Updated Title", content: "# Updated" });
    if (updated.title !== "Updated Title") {throw new Error("Title not updated");}
    if (updated.content !== "# Updated") {throw new Error("Content not updated");}
    console.log(`   ✓ Title: ${updated.title}`);
    console.log(`   ✓ Content updated`);

    // Test 5: saveAttachment
    console.log("\n5) saveAttachment...");
    const testFile = new File(["hello attachment"], "test.txt", { type: "text/plain" });
    const att = await saveAttachment(note.id, testFile);
    console.log(`   ✓ Attachment ID: ${att.id}`);
    console.log(`   ✓ Original name: ${att.originalName}`);
    console.log(`   ✓ MIME: ${att.mimeType}`);

    // Test 6: listAttachments
    console.log("\n6) listAttachments...");
    const atts = await listAttachments(note.id);
    if (atts.length !== 1) {throw new Error(`Expected 1 attachment, got ${String(atts.length)}`);}
    console.log(`   ✓ Found ${String(atts.length)} attachment(s)`);

    // Test 7: deleteAttachment
    console.log("\n7) deleteAttachment...");
    await deleteAttachment(note.id, att.id);
    const attsAfter = await listAttachments(note.id);
    if (attsAfter.length !== 0) {throw new Error(`Expected 0 attachments, got ${String(attsAfter.length)}`);}
    console.log("   ✓ Attachment deleted");

    // Test 8: deleteNote
    console.log("\n8) deleteNote...");
    await deleteNote(note.id);
    const afterDelete = await listNotes();
    if (afterDelete.length !== 0) {throw new Error(`Expected 0 notes, got ${String(afterDelete.length)}`);}
    console.log("   ✓ Note deleted");

    console.log(`\n${sep}`);
    console.log("  ALL TESTS PASSED ✓");
    console.log(`${sep}\n`);
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
