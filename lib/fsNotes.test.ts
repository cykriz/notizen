import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import fs from 'fs/promises';
import path from 'path';
import {
  createNote,
  listNotes,
  getNote,
  updateNote,
  listAttachments,
  saveAttachment,
  deleteAttachment,
} from './fsNotes';
import { attachmentDownloadPath } from './attachmentUpload';
import { moveNoteToTrash, permanentlyDeleteNote } from './fsTrash';
import { listAllTags } from './tagTree';

describe('fsNotes', () => {
  const originalRoot = process.env.NOTES_ROOT;
  const testRoot = path.join(process.cwd(), `.test-notes-${String(Date.now())}`);

  beforeAll(() => {
    process.env.NOTES_ROOT = testRoot;
  });

  afterAll(async () => {
    if (originalRoot === undefined) {
      delete process.env.NOTES_ROOT;
    } else {
      process.env.NOTES_ROOT = originalRoot;
    }

    await fs.rm(testRoot, { recursive: true, force: true });
  });

  // Single sequential lifecycle: each step depends on the previous one's mutation
  // of shared filesystem state, so splitting into independent `test`s would either
  // require per-test fixtures or break under randomized order.
  test('full CRUD lifecycle (create → list → update → tags → attach → detach → delete)', async () => {
    const note = await createNote({ title: 'Test Note', content: '# Hello World', tags: ['dev/ts'] }, testRoot);
    expect(note.slug).toMatch(/^\d{4}-\d{2}-\d{2}-test-note-[a-f0-9]+$/);
    expect(note.tags[0]).toBe('dev/ts');
    expect(note.pinned).toBe(false);

    const listed = await listNotes(testRoot);
    expect(listed).toHaveLength(1);
    expect(listed[0].tags[0]).toBe('dev/ts');

    const fetched = await getNote(note.id, testRoot);
    expect(fetched?.content).toBe('# Hello World');

    const updated = await updateNote(note.id, { title: 'Updated', content: '# Updated', tags: ['a/b'], pinned: true }, testRoot);
    expect(updated.title).toBe('Updated');
    expect(updated.tags[0]).toBe('a/b');
    expect(updated.pinned).toBe(true);

    const allTags = listAllTags(await listNotes(testRoot));
    expect(allTags[0]).toBe('a/b');

    const att = await saveAttachment(note.id, new File(['data'], 'test.txt', { type: 'text/plain' }), testRoot);
    expect(att.id).toMatch(/^[a-f0-9]{8}$/);

    const atts = await listAttachments(note.id, testRoot);
    expect(atts).toHaveLength(1);

    await deleteAttachment(note.id, att.id, testRoot);
    expect(await listAttachments(note.id, testRoot)).toHaveLength(0);

    await moveNoteToTrash(note.id, testRoot);
    expect(await listNotes(testRoot)).toHaveLength(0);
  });

  // The sidebar badge counts what the note shows: an image only while its link
  // is in the body, since the editor list never shows images.
  test('attachmentCount and disk follow the image links in the body', async () => {
    const note = await createNote({ title: 'Badge Note', content: 'text' }, testRoot);
    const image = await saveAttachment(note.id, new File(['img'], 'pic.png', { type: 'image/png' }), testRoot);
    const countInList = async () => (await listNotes(testRoot)).find((n) => n.id === note.id)?.attachmentCount;

    // Unlinked image: on disk, invisible in the note.
    expect(await countInList()).toBe(0);
    expect((await getNote(note.id, testRoot))?.attachmentCount).toBe(0);

    const url = attachmentDownloadPath(note.id, image.id);
    const linked = await updateNote(note.id, { content: `![pic.png](${url})` }, testRoot);
    expect(linked.attachmentCount).toBe(1);
    expect(await countInList()).toBe(1);
    expect((await getNote(note.id, testRoot))?.attachmentCount).toBe(1);

    // A plain link to the image counts too — the URL is the anchor.
    expect((await updateNote(note.id, { content: `[pic.png](${url})` }, testRoot)).attachmentCount).toBe(1);

    // Another note linking the same URL keeps the file alive.
    const other = await createNote({ title: 'Copy Note', content: `![pic.png](${url})` }, testRoot);
    expect((await updateNote(note.id, { content: 'text' }, testRoot)).attachmentCount).toBe(0);
    expect((await listAttachments(note.id, testRoot)).map((a) => a.id)).toEqual([image.id]);

    // A trashed note still counts as a reference — it can be restored.
    await updateNote(note.id, { content: `![pic.png](${url})` }, testRoot);
    await moveNoteToTrash(other.id, testRoot);
    await updateNote(note.id, { content: 'text' }, testRoot);
    expect((await listAttachments(note.id, testRoot)).map((a) => a.id)).toEqual([image.id]);

    // Removing the line with no other reference deletes the file from disk.
    await updateNote(note.id, { content: `![pic.png](${url})` }, testRoot);
    await permanentlyDeleteNote(other.id, testRoot);
    expect((await updateNote(note.id, { content: 'text' }, testRoot)).attachments).toEqual([]);
    expect(await listAttachments(note.id, testRoot)).toEqual([]);
    expect(await countInList()).toBe(0);

    // A fresh upload whose link has not been saved yet must survive a save.
    const fresh = await saveAttachment(note.id, new File(['img'], 'new.png', { type: 'image/png' }), testRoot);
    await updateNote(note.id, { content: 'text edited' }, testRoot);
    expect((await listAttachments(note.id, testRoot)).map((a) => a.id)).toEqual([fresh.id]);

    // Non-image files stay listed under the editor, link or not.
    await saveAttachment(note.id, new File(['doc'], 'doc.pdf', { type: 'application/pdf' }), testRoot);
    expect(await countInList()).toBe(1);

    await moveNoteToTrash(note.id, testRoot);
  });
});
