import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import fs from 'fs/promises';
import path from 'path';
import { attachmentsDir, findSlugByNoteId } from './fsHelpers';
import {
  NotFoundError,
  createNote,
  deleteAttachment,
  getAttachmentFilePath,
  listAttachments,
  saveAttachment,
} from './fsNotes';
import { listTrashedNotes, moveNoteToTrash } from './fsTrash';

describe('fsAttachments: NAS and macOS metadata entries', () => {
  const originalRoot = process.env.NOTES_ROOT;
  const testRoot = path.join(process.cwd(), `.test-attachments-${String(Date.now())}`);

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

  // One real attachment beside a Synology @eaDir dir, .DS_Store and an
  // AppleDouble file shadowing the real id.
  async function seedNote() {
    const note = await createNote({ title: 'NAS', content: 'body' }, testRoot);
    const real = await saveAttachment(note.id, new File(['data'], 'a.txt'), testRoot);
    const slug = await findSlugByNoteId(note.id, testRoot);
    if (slug === null) {
      throw new Error('slug not found');
    }

    const attDir = attachmentsDir(slug, testRoot);
    await fs.mkdir(path.join(attDir, '@eaDir'));
    await fs.writeFile(path.join(attDir, '@eaDir', 'thumb.jpg'), 'x');
    await fs.writeFile(path.join(attDir, '.DS_Store'), 'x');
    const appleDouble = path.join(attDir, `._${real.id}_x`);
    await fs.writeFile(appleDouble, 'x');
    return { noteId: note.id, realId: real.id, attDir, appleDouble };
  }

  test('listAttachments returns only the stored attachment', async () => {
    const { noteId, realId } = await seedNote();
    expect((await listAttachments(noteId, testRoot)).map((a) => a.id)).toEqual([realId]);
  });

  test('download and delete reject metadata entries and leave them on disk', async () => {
    const { noteId, realId, attDir, appleDouble } = await seedNote();
    const caught = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);
    expect(await caught(getAttachmentFilePath(noteId, `._${realId}`, testRoot))).toBeInstanceOf(NotFoundError);
    expect(await caught(deleteAttachment(noteId, `._${realId}`, testRoot))).toBeInstanceOf(NotFoundError);
    expect(await caught(deleteAttachment(noteId, '@eaDir', testRoot))).toBeInstanceOf(NotFoundError);
    await fs.access(appleDouble);
    await fs.access(path.join(attDir, '@eaDir'));
  });

  test('trashed attachmentCount counts only the stored attachment', async () => {
    const { noteId } = await seedNote();
    await moveNoteToTrash(noteId, testRoot);
    const trashed = await listTrashedNotes(testRoot);
    expect(trashed.find((n) => n.id === noteId)?.attachmentCount).toBe(1);
  });
});
