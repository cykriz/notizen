import { describe, expect, test } from 'bun:test';

import { applyAttachmentChange } from './offlineAttachments';
import type { Attachment, NoteSummary } from './types';

function note(id: string, attachmentCount: number): NoteSummary {
  return {
    id,
    slug: `slug-${id}`,
    title: `Notiz ${id}`,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    attachmentCount,
    tags: ['dev/test'],
    pinned: false,
  };
}

const att: Attachment = {
  id: 'a1b2c3d4',
  originalName: 'hinweis.txt',
  mimeType: 'text/plain',
  size: 12,
  relativePath: 'attachments/a1b2c3d4_hinweis.txt',
};

const notes: NoteSummary[] = [note('n1', 2), note('n2', 0)];

describe('applyAttachmentChange', () => {
  test('an added attachment increments only the matching row', () => {
    const next = applyAttachmentChange(notes, 'n1', { added: att });
    expect(next[0].attachmentCount).toBe(3);
    expect(next[1]).toBe(notes[1]);
  });

  test('a removed attachment decrements only the matching row', () => {
    const next = applyAttachmentChange(notes, 'n1', { removedId: att.id });
    expect(next[0].attachmentCount).toBe(1);
    expect(next[1]).toBe(notes[1]);
  });

  test('successive deltas add up — a multi-file upload reports once per file', () => {
    let next = applyAttachmentChange(notes, 'n1', { added: att });
    next = applyAttachmentChange(next, 'n1', { added: att });
    next = applyAttachmentChange(next, 'n1', { added: att });
    expect(next[0].attachmentCount).toBe(5);
  });

  test('clamps at 0 instead of going negative — a negative count would swallow the next increment', () => {
    const cleared = applyAttachmentChange(notes, 'n2', { removedId: att.id });
    expect(cleared[1].attachmentCount).toBe(0);
    expect(applyAttachmentChange(cleared, 'n2', { added: att })[1].attachmentCount).toBe(1);
  });

  test('leaves every other field untouched — a faked updatedAt would 409 on the next save', () => {
    const next = applyAttachmentChange(notes, 'n1', { added: att });
    expect(next[0]).toEqual({ ...notes[0], attachmentCount: 3 });
  });

  test('an unknown id hands back the input reference', () => {
    expect(applyAttachmentChange(notes, 'weg', { added: att })).toBe(notes);
    expect(applyAttachmentChange([], 'n1', { removedId: att.id })).toEqual([]);
  });

  test('does not mutate the input', () => {
    applyAttachmentChange(notes, 'n1', { added: att });
    expect(notes[0].attachmentCount).toBe(2);
  });
});
