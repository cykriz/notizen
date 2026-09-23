import { describe, expect, it } from 'bun:test';
import { QUADRANT } from './constants';
import { ORDER_STEP, compareInbox, dropsAbove, inboxDropRank, inboxRankFor, rankOf } from './todoOrder';
import type { Todo } from './types';

function todo(overrides: Partial<Todo> & { id: string }): Todo {
  return {
    title: `Aufgabe ${overrides.id}`,
    quadrant: QUADRANT.INBOX,
    completed: false,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    ...overrides,
  };
}

/** Three ranked inbox rows, 1000 apart — the shape a few drags produce. */
const ranked = [todo({ id: 'a', order: 1000 }), todo({ id: 'b', order: 2000 }), todo({ id: 'c', order: 3000 })];

const sortedIds = (todos: Todo[]) => [...todos].sort(compareInbox).map((t) => t.id);

describe('rankOf', () => {
  it('uses a stored order when there is one', () => {
    expect(rankOf(todo({ id: 'x', order: 42 }))).toBe(42);
  });

  it('falls back to createdAt, which is why no backfill was needed', () => {
    expect(rankOf(todo({ id: 'x', createdAt: '2026-08-01T08:00:00.000Z' })))
      .toBe(Date.parse('2026-08-01T08:00:00.000Z'));
  });

  it('treats order 0 as a rank, not as absent', () => {
    expect(rankOf(todo({ id: 'x', order: 0 }))).toBe(0);
  });
});

describe('compareInbox', () => {
  it('sorts ascending by rank', () => {
    expect(sortedIds([ranked[2], ranked[0], ranked[1]])).toEqual(['a', 'b', 'c']);
  });

  it('mixes ranked and unranked rows on one scale', () => {
    // An unranked row created in 2026 outranks an order of 1000 (epoch milliseconds).
    const legacy = todo({ id: 'legacy', createdAt: '2026-08-01T08:00:00.000Z' });
    expect(sortedIds([legacy, ranked[0]])).toEqual(['a', 'legacy']);
  });

  it('breaks a tie by id so two devices cannot render a different sequence', () => {
    const b = todo({ id: 'b', order: 5 });
    const a = todo({ id: 'a', order: 5 });
    expect(sortedIds([b, a])).toEqual(['a', 'b']);
    expect(compareInbox(a, a)).toBe(0);
  });
});

describe('inboxRankFor', () => {
  it('starts from the clock for an empty column', () => {
    const before = Date.now();
    expect(inboxRankFor(QUADRANT.INBOX, []).order).toBeGreaterThanOrEqual(before);
  });

  it('appends one step past the last row', () => {
    expect(inboxRankFor(QUADRANT.INBOX, ranked).order).toBe(3000 + ORDER_STEP);
  });

  it('counts derived ranks too, not just stored ones', () => {
    const legacy = todo({ id: 'legacy', createdAt: '2026-08-01T08:00:00.000Z' });
    expect(inboxRankFor(QUADRANT.INBOX, [...ranked, legacy]).order)
      .toBe(Date.parse(legacy.createdAt) + ORDER_STEP);
  });

  it('ignores Erledigen, Erledigt and trashed rows', () => {
    const noise = [
      todo({ id: 'do', quadrant: QUADRANT.DO, order: 9_000_000 }),
      todo({ id: 'done', completed: true, order: 9_000_000 }),
      todo({ id: 'gone', order: 9_000_000, trashedAt: '2026-08-02T08:00:00.000Z' }),
    ];
    expect(inboxRankFor(QUADRANT.INBOX, [...ranked, ...noise]).order).toBe(3000 + ORDER_STEP);
  });

  it('writes no rank outside Eingang — the key stays absent', () => {
    const forDo = inboxRankFor(QUADRANT.DO, ranked);
    expect(forDo).toEqual({});
    expect(Object.hasOwn(forDo, 'order')).toBe(false);
  });
});

describe('inboxDropRank', () => {
  it('drops above the first row', () => {
    expect(inboxDropRank(ranked, 'a', 'c')).toBe(1000 - ORDER_STEP);
  });

  it('takes the midpoint between two rows', () => {
    expect(inboxDropRank(ranked, 'c', 'a')).toBe(2500);
  });

  it('appends when beforeId is null', () => {
    expect(inboxDropRank(ranked, null, 'a')).toBe(3000 + ORDER_STEP);
  });

  it('excludes the dragged row from the neighbourhood', () => {
    // Without removing 'b' first, the midpoint would be measured against itself and
    // land at 2000 — exactly where the row already sits.
    expect(inboxDropRank(ranked, 'a', 'b')).toBe(1000 - ORDER_STEP);
  });

  it('treats an anchor that no longer exists as the bottom', () => {
    expect(inboxDropRank(ranked, 'weg', 'a')).toBe(3000 + ORDER_STEP);
  });

  it('handles a column holding only the dragged row', () => {
    const rank = inboxDropRank([todo({ id: 'only', order: 1000 })], null, 'only');
    expect(rank).toBeNull();
  });

  it('returns null when the row is dropped onto itself', () => {
    expect(inboxDropRank(ranked, 'b', 'b')).toBeNull();
  });

  it('returns null when the anchor is the row that already follows', () => {
    expect(inboxDropRank(ranked, 'b', 'a')).toBeNull();
  });

  it('returns null for an append when the row is already last', () => {
    expect(inboxDropRank(ranked, null, 'c')).toBeNull();
  });

  it('never reports a no-op for a todo coming from another column', () => {
    const fromDo = todo({ id: 'd', quadrant: QUADRANT.DO });
    expect(inboxDropRank([...ranked, fromDo], null, 'd')).toBe(3000 + ORDER_STEP);
  });

  it('ranks a drop into an empty column from the clock', () => {
    const before = Date.now();
    const rank = inboxDropRank([todo({ id: 'd', quadrant: QUADRANT.DO })], null, 'd');
    expect(rank).toBeGreaterThanOrEqual(before);
  });
});

describe('dropsAbove', () => {
  const rect = { top: 100, height: 40 };

  it('is true in the upper half', () => {
    expect(dropsAbove(110, rect)).toBe(true);
  });

  it('is false in the lower half', () => {
    expect(dropsAbove(130, rect)).toBe(false);
  });

  it('counts the exact middle as below', () => {
    expect(dropsAbove(120, rect)).toBe(false);
  });
});
