import { QUADRANT } from './constants';
import { byUpdatedAtDesc } from './utils';
import type { Todo, TodoColumnMeta, TodoQuadrant } from './types';

// Own module rather than more entries in lib/constants.ts: that file sits at its
// 200-line cap, and the column model needs the Todo type plus two functions, which
// a constants file has no business carrying. Same split as lib/quadrantAlias.ts.

/**
 * The three board columns. INBOX and DO equal the persisted `quadrant` values;
 * DONE has no persisted counterpart — it is derived from `completed`, so the data
 * model keeps one truth per todo instead of two that can drift apart.
 */
export const TODO_COLUMN = {
  INBOX: 'inbox',
  DO: 'do',
  DONE: 'done',
} as const;

export type TodoColumnKey = (typeof TODO_COLUMN)[keyof typeof TODO_COLUMN];

/** Hard WIP limit on "Erledigen". No overbooking — canEnterDo is the only gate. */
export const DO_LIMIT = 3;

export const TODO_COLUMN_META: readonly TodoColumnMeta[] = [
  // Eingang steht bewusst an erster Stelle (Dump-First-Workflow, mobil große Kachel).
  { key: TODO_COLUMN.INBOX, icon: '📥', label: 'Eingang', description: 'Alles landet zuerst hier' },
  {
    key: TODO_COLUMN.DO,
    icon: '🔨',
    label: 'Erledigen',
    description: `Höchstens ${String(DO_LIMIT)} gleichzeitig`,
    limit: DO_LIMIT,
  },
  { key: TODO_COLUMN.DONE, icon: '✅', label: 'Erledigt', description: 'Bis zum Wochenritual' },
];

// German board strings, shared with the e2e suite so an assertion cannot drift
// from the rendered text.
export const DO_FULL_PLACEHOLDER = `${String(DO_LIMIT)} Slots belegt`;
export const CLEAR_DONE_LABEL = 'erledigte löschen';
export const ADD_DETAILED_LABEL = 'Aufgabe mit Details anlegen';

/** Which column a todo renders in. `completed` wins over the stored quadrant. */
export function columnOf(todo: Todo): TodoColumnKey {
  return todo.completed ? TODO_COLUMN.DONE : todo.quadrant;
}

/**
 * The persisted quadrant a column writes. The single owner of that mapping — the
 * board's dialog default, the quick-add and the drop handler all go through it, so
 * DONE cannot leak into a field that has no value for it.
 */
export function quadrantOf(column: TodoColumnKey): TodoQuadrant {
  return column === TODO_COLUMN.DO ? QUADRANT.DO : QUADRANT.INBOX;
}

function openInDo(todos: Todo[]): Todo[] {
  return todos.filter((t) => t.trashedAt === undefined && columnOf(t) === TODO_COLUMN.DO);
}

/**
 * The single WIP rule. Every one of the five ways into "Erledigen" — drag & drop,
 * quick-add, the pencil button, the dialog's Select and un-ticking a done todo —
 * asks this and nothing else, so the limit cannot drift between them.
 *
 * `todoId` is the todo about to move; one already sitting in DO always passes, so
 * editing it never trips its own limit.
 */
export function canEnterDo(todos: Todo[], todoId?: string): boolean {
  const open = openInDo(todos);
  if (todoId !== undefined && open.some((t) => t.id === todoId)) {
    return true;
  }

  return open.length < DO_LIMIT;
}

/**
 * Whether a drop of `todoId` — currently rendered in `fromColumn` — onto `column`
 * should apply.
 *
 * A pure function rather than a condition inside the drop handler: the board uses
 * native HTML5 drag & drop, which Playwright cannot drive reliably, so this is the
 * only place the rule can actually be tested. It also keeps the WIP check scoped to
 * Erledigen — an unscoped one swallows every drop on the board the moment Erledigen
 * is full, Eingang→Erledigt included.
 */
export function canDrop(todos: Todo[], todoId: string, fromColumn: string, column: TodoColumnKey): boolean {
  if (todoId === '' || fromColumn === column) {
    return false;
  }

  return column !== TODO_COLUMN.DO || canEnterDo(todos, todoId);
}

/**
 * Caps "Erledigen" at DO_LIMIT by moving the surplus back to Eingang, newest
 * `updatedAt` kept (id breaks ties so the result is stable).
 *
 * This is the MIGRATION rule, not the runtime one — canEnterDo stops a fourth
 * entry from being created in the first place. It exists for the one-time move off
 * the four-quadrant model, and as the net for the only case the UI cannot cover:
 * two devices filling the last slot at once. Hung into the server read path only
 * (lib/fsTodosStore.ts), so the fix persists on the next write.
 */
export function enforceDoLimit(todos: Todo[]): Todo[] {
  const open = openInDo(todos);
  if (open.length <= DO_LIMIT) {
    return todos;
  }

  const surplus = new Set(
    [...open]
      .sort((a, b) => {
        const byTime = byUpdatedAtDesc(a, b);
        return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
      })
      .slice(DO_LIMIT)
      .map((t) => t.id),
  );

  return todos.map((t) => (surplus.has(t.id) ? { ...t, quadrant: QUADRANT.INBOX } : t));
}
