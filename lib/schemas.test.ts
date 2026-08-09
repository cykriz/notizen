import { describe, expect, test } from 'bun:test';

import { QUADRANT } from './constants';
import {
  parseNoteSummaryRows,
  parseNoteSummaryRowsStrict,
  parseTodoRows,
  parseTodoRowsStrict,
} from './schemas';

function todo(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 't1',
    title: 'Aufgabe',
    quadrant: QUADRANT.INBOX,
    completed: false,
    createdAt: '2026-08-08T08:00:00.000Z',
    updatedAt: '2026-08-08T08:00:00.000Z',
    ...over,
  };
}

function noteSummary(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'n1',
    slug: 'notiz',
    title: 'Notiz',
    createdAt: '2026-08-08T08:00:00.000Z',
    updatedAt: '2026-08-08T08:00:00.000Z',
    attachmentCount: 0,
    tags: [],
    pinned: false,
    ...over,
  };
}

describe('parseTodoRows', () => {
  test('drops only the broken row, never the whole list', () => {
    // The regression this exists for: a whole-array parse turned one bad row
    // into a total cache wipe, taking offline-only todos with it.
    const rows = parseTodoRows([todo({ id: 'a' }), { id: 'kaputt' }, todo({ id: 'b' })]);

    expect(rows.map((t) => t.id)).toEqual(['a', 'b']);
  });

  test("rescues pre-cd9392c 'delegate' rows as 'inbox'", () => {
    const rows = parseTodoRows([todo({ id: 'alt', quadrant: 'delegate' })]);

    expect(rows).toHaveLength(1);
    expect(rows[0].quadrant).toBe(QUADRANT.INBOX);
  });

  test('rescues an unknown quadrant into Eingang rather than dropping the row', () => {
    // One answer to "what is an unknown quadrant", shared with fsTodosStore, so
    // the cache and the server-rendered first paint cannot disagree. Losing the
    // todo would be worse than showing it in the needs-sorting bucket.
    const rows = parseTodoRows([todo({ quadrant: 'irgendwas' })]);

    expect(rows).toHaveLength(1);
    expect(rows[0].quadrant).toBe(QUADRANT.INBOX);
  });

  test('a row broken for other reasons is still dropped', () => {
    expect(parseTodoRows([todo({ completed: 'ja' })])).toEqual([]);
  });

  test('returns [] for a non-array, including null and objects', () => {
    expect(parseTodoRows(null)).toEqual([]);
    expect(parseTodoRows(undefined)).toEqual([]);
    expect(parseTodoRows({ todos: [] })).toEqual([]);
    expect(parseTodoRows('[]')).toEqual([]);
  });

  test('keeps optional fields intact', () => {
    const rows = parseTodoRows([todo({ description: 'Details', dueDate: '2026-09-01', linkedNoteIds: ['n1'] })]);

    expect(rows[0].description).toBe('Details');
    expect(rows[0].dueDate).toBe('2026-09-01');
    expect(rows[0].linkedNoteIds).toEqual(['n1']);
  });

  test('survives rows that cannot be serialised for the log preview', () => {
    expect(parseTodoRows([undefined, todo({ id: 'gut' })]).map((t) => t.id)).toEqual(['gut']);
  });
});

describe('parseTodoRowsStrict / parseNoteSummaryRowsStrict', () => {
  // These guard refreshFromServer: it merges the result and writes it back, so
  // [] means "the server has nothing" and wipes the offline cache. An unreadable
  // 200 must be distinguishable from a legitimately empty one.
  test('null when every row is rejected', () => {
    expect(parseTodoRowsStrict([{ id: 'kaputt' }])).toBeNull();
    expect(parseNoteSummaryRowsStrict([{ id: 'kaputt' }, { id: 'auch-kaputt' }])).toBeNull();
  });

  test('null when the payload is not an array at all', () => {
    expect(parseTodoRowsStrict({ error: 'x' })).toBeNull();
    expect(parseTodoRowsStrict('<html>')).toBeNull();
    expect(parseNoteSummaryRowsStrict(null)).toBeNull();
  });

  test('[] for a legitimately empty list — deleting the last row must still merge', () => {
    expect(parseTodoRowsStrict([])).toEqual([]);
    expect(parseNoteSummaryRowsStrict([])).toEqual([]);
  });

  test('partial damage still yields the survivors', () => {
    const rows = parseTodoRowsStrict([todo({ id: 'a' }), { id: 'kaputt' }]);
    expect(rows?.map((t) => t.id)).toEqual(['a']);
  });

  test('rescues legacy quadrants like the lenient variant', () => {
    expect(parseTodoRowsStrict([todo({ quadrant: 'delegate' })])?.[0].quadrant).toBe(QUADRANT.INBOX);
  });
});

describe('parseNoteSummaryRows', () => {
  test('drops only the broken row', () => {
    const rows = parseNoteSummaryRows([noteSummary({ id: 'a' }), { id: 'kaputt' }, noteSummary({ id: 'b' })]);

    expect(rows.map((n) => n.id)).toEqual(['a', 'b']);
  });

  test('rejects a row missing a required field rather than defaulting it', () => {
    const { pinned: _pinned, ...withoutPinned } = noteSummary();

    expect(parseNoteSummaryRows([withoutPinned])).toEqual([]);
  });

  test('returns [] for a non-array', () => {
    expect(parseNoteSummaryRows(null)).toEqual([]);
    expect(parseNoteSummaryRows({})).toEqual([]);
  });
});
