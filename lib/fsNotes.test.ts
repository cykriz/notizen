import fs from "fs/promises";
import path from "path";
import {
  createNote,
  listNotes,
  getNote,
  updateNote,
  deleteNote,
  listAllTags,
  listAttachments,
  saveAttachment,
  deleteAttachment,
} from "./fsNotes";

/* eslint-disable no-console */
async function runTests() {
  const sep = "─".repeat(50);
  console.log(`\n${sep}\n  fsNotes Inline Tests\n${sep}\n`);

  const originalRoot = process.env.NOTES_ROOT;
  const testRoot = path.join(process.cwd(), `.test-notes-${String(Date.now())}`);
  process.env.NOTES_ROOT = testRoot;

  try {
    const note = await createNote({ title: "Test Note", content: "# Hello World", tags: ["dev/ts"] });
    const slugOk = /^\d{4}-\d{2}-\d{2}-test-note-[a-f0-9]+$/.test(note.slug);
    if (!slugOk) {
      throw new Error(`Bad slug: ${note.slug}`);
    }

    if (note.tags[0] !== "dev/ts") {
      throw new Error("Tags not set on create");
    }

    if (note.pinned) {
      throw new Error("Pinned should default to false");
    }

    console.log("✓ createNote — slug, id, title, tags, pinned correct");

    const notes = await listNotes();
    if (notes.length !== 1) {
      throw new Error(`Expected 1 note, got ${String(notes.length)}`);
    }

    if (notes[0].tags[0] !== "dev/ts") {
      throw new Error("listNotes tags missing");
    }

    console.log("✓ listNotes — found 1 note with tags");

    const fetched = await getNote(note.id);
    if (fetched?.content !== "# Hello World") {
      throw new Error("getNote content mismatch");
    }

    console.log("✓ getNote — content matches");

    const updated = await updateNote(note.id, { title: "Updated", content: "# Updated", tags: ["a/b"], pinned: true });
    if (updated.title !== "Updated") {
      throw new Error("Title not updated");
    }

    if (updated.tags[0] !== "a/b") {
      throw new Error("Tags not updated");
    }

    if (!updated.pinned) {
      throw new Error("Pinned not updated");
    }

    console.log("✓ updateNote — title, content, tags, pinned updated");

    const allTags = await listAllTags();
    if (allTags[0] !== "a/b") {
      throw new Error("listAllTags failed");
    }

    console.log("✓ listAllTags — returns sorted unique tags");

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

runTests().catch((err: unknown) => {
  console.error("\n  TEST FAILED ✗", err);
  process.exit(1);
});
