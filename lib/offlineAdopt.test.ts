import { describe, expect, test } from 'bun:test';

import { upsertById } from './offlineAdopt';

interface Row { id: string; v: string }

const rows: Row[] = [{ id: 'a', v: '1' }, { id: 'b', v: '2' }];

describe('upsertById', () => {
  test('replaces in place, keeping position', () => {
    expect(upsertById(rows, { id: 'a', v: 'neu' }, 'end')).toEqual([
      { id: 'a', v: 'neu' },
      { id: 'b', v: '2' },
    ]);
  });

  test('appends a new row when `at` is end — todos sort by updatedAt server-side', () => {
    expect(upsertById(rows, { id: 'c', v: '3' }, 'end').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  test('prepends a new row when `at` is start — notes show newest first', () => {
    expect(upsertById(rows, { id: 'c', v: '3' }, 'start').map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  test('`at` is ignored for a row that already exists', () => {
    expect(upsertById(rows, { id: 'b', v: 'neu' }, 'start').map((r) => r.id)).toEqual(['a', 'b']);
  });

  test('does not mutate the input', () => {
    upsertById(rows, { id: 'a', v: 'neu' }, 'end');
    expect(rows[0].v).toBe('1');
  });

  test('inserting into an empty list works for both positions', () => {
    expect(upsertById([], { id: 'a', v: '1' }, 'start')).toEqual([{ id: 'a', v: '1' }]);
    expect(upsertById([], { id: 'a', v: '1' }, 'end')).toEqual([{ id: 'a', v: '1' }]);
  });
});
