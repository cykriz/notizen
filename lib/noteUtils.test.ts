import { describe, expect, test } from 'bun:test';
import { extractNoteId } from './noteUtils';

describe('extractNoteId', () => {
  test('reads the ID from a note route', () => {
    expect(extractNoteId('/notes/abc')).toBe('abc');
  });

  test('is anchored, so an API path with the same segments is not a note route', () => {
    expect(extractNoteId('/api/notes/abc')).toBeNull();
  });

  test('does not match nested paths below a note', () => {
    expect(extractNoteId('/notes/abc/attachments')).toBeNull();
  });

  test('returns null for the note list and for other sections', () => {
    expect(extractNoteId('/notes')).toBeNull();
    expect(extractNoteId('/todos/abc')).toBeNull();
  });
});
