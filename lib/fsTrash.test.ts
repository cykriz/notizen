import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import fs from 'fs/promises';
import path from 'path';
import { createNote, getNote, saveAttachment, listAttachments } from './fsNotes';
import {
  moveNoteToTrash,
  restoreNoteFromTrash,
  permanentlyDeleteNote,
  listTrashedNotes,
} from './fsTrash';
import { purgeExpiredNotes } from './fsTrashPurge';

describe('fsTrash', () => {
  const originalRoot = process.env.NOTES_ROOT;
  const testRoot = path.join(process.cwd(), `.test-trash-${String(Date.now())}`);

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

  test('move → list → restore roundtrip keeps attachments', async () => {
    const note = await createNote({ title: 'Trash Me', content: 'body' }, testRoot);
    await saveAttachment(note.id, new File(['data'], 'a.txt', { type: 'text/plain' }), testRoot);

    await moveNoteToTrash(note.id, testRoot);
    // Invisible to the active APIs.
    expect(await getNote(note.id, testRoot)).toBeNull();
    const trashed = await listTrashedNotes(testRoot);
    expect(trashed).toHaveLength(1);
    expect(trashed[0].id).toBe(note.id);
    expect(typeof trashed[0].trashedAt).toBe('string');
    expect(trashed[0].attachmentCount).toBe(1);

    await restoreNoteFromTrash(note.id, testRoot);
    const restored = await getNote(note.id, testRoot);
    expect(restored?.title).toBe('Trash Me');
    expect(await listTrashedNotes(testRoot)).toHaveLength(0);
    expect(await listAttachments(note.id, testRoot)).toHaveLength(1);
  });

  test('permanentlyDeleteNote removes it for good', async () => {
    const note = await createNote({ title: 'Perma', content: '' }, testRoot);
    await moveNoteToTrash(note.id, testRoot);
    await permanentlyDeleteNote(note.id, testRoot);
    expect(await listTrashedNotes(testRoot)).toHaveLength(0);
    expect(await getNote(note.id, testRoot)).toBeNull();
  });

  test('purgeExpiredNotes removes expired trashed notes', async () => {
    const note = await createNote({ title: 'Old', content: '' }, testRoot);
    await moveNoteToTrash(note.id, testRoot);
    expect(await listTrashedNotes(testRoot)).toHaveLength(1);
    const removed = await purgeExpiredNotes(testRoot, 0);
    expect(removed).toHaveLength(1);
    expect(removed).toContain(note.id);
    expect(await listTrashedNotes(testRoot)).toHaveLength(0);
  });
});
