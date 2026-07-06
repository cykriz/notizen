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
import { moveNoteToTrash } from './fsTrash';
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
});
