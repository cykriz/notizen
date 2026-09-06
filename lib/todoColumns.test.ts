import { describe, expect, it } from 'bun:test';
import { QUADRANT } from './constants';
import { DO_LIMIT, TODO_COLUMN, canDrop, canEnterDo, columnOf, enforceDoLimit } from './todoColumns';
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

const inDo = (id: string, updatedAt = '2026-08-01T08:00:00.000Z') =>
  todo({ id, quadrant: QUADRANT.DO, updatedAt });

describe('columnOf', () => {
  it('maps the two persisted quadrants onto their columns', () => {
    expect(columnOf(todo({ id: 'a' }))).toBe(TODO_COLUMN.INBOX);
    expect(columnOf(todo({ id: 'b', quadrant: QUADRANT.DO }))).toBe(TODO_COLUMN.DO);
  });

  it('lets completed win over the stored quadrant', () => {
    // The quadrant survives underneath so un-ticking can put the todo back.
    expect(columnOf(todo({ id: 'c', quadrant: QUADRANT.DO, completed: true }))).toBe(TODO_COLUMN.DONE);
    expect(columnOf(todo({ id: 'd', quadrant: QUADRANT.INBOX, completed: true }))).toBe(TODO_COLUMN.DONE);
  });
});

describe('canEnterDo', () => {
  it('allows an entry while a slot is free', () => {
    expect(canEnterDo([inDo('1'), inDo('2')])).toBe(true);
  });

  it('blocks once DO_LIMIT open entries sit in Erledigen', () => {
    expect(canEnterDo([inDo('1'), inDo('2'), inDo('3')])).toBe(false);
  });

  it('always allows a todo that is already in Erledigen', () => {
    const full = [inDo('1'), inDo('2'), inDo('3')];
    expect(canEnterDo(full, '2')).toBe(true);
    expect(canEnterDo(full, 'other')).toBe(false);
  });

  it('does not count completed entries — they render in Erledigt', () => {
    const done = [1, 2, 3].map((n) => todo({ id: `d${String(n)}`, quadrant: QUADRANT.DO, completed: true }));
    expect(canEnterDo(done)).toBe(true);
  });

  it('does not count trashed entries', () => {
    const trashed = [1, 2, 3].map((n) =>
      todo({ id: `t${String(n)}`, quadrant: QUADRANT.DO, trashedAt: '2026-08-02T08:00:00.000Z' }),
    );
    expect(canEnterDo(trashed)).toBe(true);
  });
});

describe('canDrop', () => {
  const full = [inDo('1'), inDo('2'), inDo('3')];

  it('rejects a drop onto the column the todo already sits in', () => {
    expect(canDrop([], 'x', TODO_COLUMN.INBOX, TODO_COLUMN.INBOX)).toBe(false);
  });

  it('rejects an empty id — a drag that carried no todo', () => {
    expect(canDrop([], '', TODO_COLUMN.INBOX, TODO_COLUMN.DO)).toBe(false);
  });

  it('blocks a drop into a full Erledigen', () => {
    expect(canDrop(full, 'neu', TODO_COLUMN.INBOX, TODO_COLUMN.DO)).toBe(false);
  });

  it('lets a todo already in Erledigen be dropped back out of it', () => {
    expect(canDrop(full, '2', TODO_COLUMN.DO, TODO_COLUMN.INBOX)).toBe(true);
    expect(canDrop(full, '2', TODO_COLUMN.DO, TODO_COLUMN.DONE)).toBe(true);
  });

  it('leaves every other column open while Erledigen is full', () => {
    // The regression: an unscoped WIP check swallowed these too, so with three
    // entries in Erledigen nothing on the board could be dropped anywhere.
    expect(canDrop(full, 'neu', TODO_COLUMN.INBOX, TODO_COLUMN.DONE)).toBe(true);
    expect(canDrop(full, 'neu', TODO_COLUMN.DONE, TODO_COLUMN.INBOX)).toBe(true);
  });
});

describe('enforceDoLimit', () => {
  it('leaves a list at or under the limit untouched', () => {
    const todos = [inDo('1'), inDo('2'), inDo('3'), todo({ id: '4' })];
    expect(enforceDoLimit(todos)).toBe(todos);
  });

  it('keeps the DO_LIMIT most recently updated and sends the rest to Eingang', () => {
    // The migration rule: five entries survive the old four-quadrant board.
    const todos = [
      inDo('oldest', '2026-08-01T08:00:00.000Z'),
      inDo('newest', '2026-08-05T08:00:00.000Z'),
      inDo('mid-a', '2026-08-04T08:00:00.000Z'),
      inDo('second-oldest', '2026-08-02T08:00:00.000Z'),
      inDo('mid-b', '2026-08-03T08:00:00.000Z'),
    ];

    const result = enforceDoLimit(todos);
    const stillInDo = result.filter((t) => t.quadrant === QUADRANT.DO).map((t) => t.id);
    expect(stillInDo).toHaveLength(DO_LIMIT);
    expect(stillInDo.sort()).toEqual(['mid-a', 'mid-b', 'newest']);
    expect(result.filter((t) => t.quadrant === QUADRANT.INBOX).map((t) => t.id).sort()).toEqual([
      'oldest',
      'second-oldest',
    ]);
  });

  it('breaks ties on id so the outcome does not depend on array order', () => {
    const same = '2026-08-01T08:00:00.000Z';
    const ids = ['e', 'd', 'c', 'b', 'a'].map((id) => inDo(id, same));
    const kept = enforceDoLimit(ids)
      .filter((t) => t.quadrant === QUADRANT.DO)
      .map((t) => t.id);
    expect(kept).toEqual(['c', 'b', 'a']);

    const reversed = enforceDoLimit([...ids].reverse())
      .filter((t) => t.quadrant === QUADRANT.DO)
      .map((t) => t.id);
    expect(reversed.sort()).toEqual(kept.sort());
  });

  it('ignores completed and trashed rows when deciding the surplus', () => {
    const todos = [
      inDo('open-1'),
      inDo('open-2'),
      todo({ id: 'done', quadrant: QUADRANT.DO, completed: true, updatedAt: '2026-09-01T08:00:00.000Z' }),
      todo({ id: 'trashed', quadrant: QUADRANT.DO, trashedAt: '2026-09-01T08:00:00.000Z' }),
    ];
    expect(enforceDoLimit(todos)).toBe(todos);
  });
});
