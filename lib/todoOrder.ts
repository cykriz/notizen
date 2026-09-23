import { QUADRANT } from './constants';
import { TODO_COLUMN, columnOf } from './todoColumns';
import type { Todo, TodoQuadrant } from './types';

// The manual order of the "Eingang" column. Its own module rather than more entries
// in lib/todoColumns.ts: that file owns the column model and the WIP rule, this one
// owns rank arithmetic. Pure and DOM-free on purpose — the board uses native HTML5
// drag & drop, which Playwright cannot drive, so this is the only place the rules can
// actually be tested (the same bargain canDrop already documents).

/** Gap between two freshly assigned ranks. */
export const ORDER_STEP = 1000;

/**
 * The rank a todo sorts by. Never undefined: a row without a stored `order` falls
 * back to its creation time, which sits in the same millisecond scale as every rank
 * assigned later.
 *
 * That fallback is what made a backfill unnecessary — existing rows already carry a
 * usable rank, so `order` is written only when somebody actually drags or creates.
 */
export function rankOf(todo: Todo): number {
  return todo.order ?? Date.parse(todo.createdAt);
}

/**
 * Ascending by rank, `id` breaking ties. The tiebreak is not cosmetic: it makes the
 * order total, so two rows that ever end up on the same rank cannot render in a
 * different sequence on two devices.
 */
export function compareInbox(a: Todo, b: Todo): number {
  const byRank = rankOf(a) - rankOf(b);
  return byRank !== 0 ? byRank : a.id.localeCompare(b.id);
}

/**
 * The open Eingang rows of `todos`, sorted — the one derivation of that sequence.
 * The board renders it and inboxDropRank reasons over it; two independent copies
 * would agree until one of them changed, and then drop rows a slot off.
 */
export function inboxOf(todos: Todo[]): Todo[] {
  return todos
    .filter((t) => t.trashedAt === undefined && columnOf(t) === TODO_COLUMN.INBOX)
    .sort(compareInbox);
}

/** The rank for a todo appended to the bottom of Eingang. */
function nextInboxRank(todos: Todo[]): number {
  const last = inboxOf(todos).at(-1);
  return last === undefined ? Date.now() : rankOf(last) + ORDER_STEP;
}

/**
 * The `order` a newly created todo carries — a bottom rank in Eingang, nothing
 * anywhere else. Spread into the create payload, so the quick-add and the dialog
 * cannot answer this differently.
 */
export function inboxRankFor(quadrant: TodoQuadrant, todos: Todo[]): { order?: number } {
  return quadrant === QUADRANT.INBOX ? { order: nextInboxRank(todos) } : {};
}

/**
 * The rank that places `movingId` directly above `beforeId` — `beforeId === null`
 * means "at the bottom". Returns `null` when the drop would land the row exactly
 * where it already sits, so the caller writes nothing.
 *
 * Takes `beforeId` rather than an index: an index expressed against the rendered list
 * (which still contains the dragged row) needs an off-by-one correction, and that
 * correction is the classic source of "lands one slot too far".
 *
 * No precision guard. The starting gaps are milliseconds wide and a double carries
 * ~50 halvings of one gap; should two ranks ever meet, compareInbox's id tiebreak
 * decides and the row sits one position off — nothing breaks.
 */
export function inboxDropRank(todos: Todo[], beforeId: string | null, movingId: string): number | null {
  const inbox = inboxOf(todos);

  // Already there? `current !== -1` guards the cross-column case: a todo dragged in
  // from Erledigen is not in this column yet, so it can never be a no-op. Anchoring on
  // itself counts too — the sensor reports that for the upper half of its own card.
  const current = inbox.findIndex((t) => t.id === movingId);
  if (current !== -1 && (beforeId === movingId || (inbox[current + 1]?.id ?? null) === beforeId)) {
    return null;
  }

  // The dragged row goes first — otherwise a move inside the column would measure a
  // midpoint against itself.
  const rest = inbox.filter((t) => t.id !== movingId);
  const anchor = beforeId === null ? -1 : rest.findIndex((t) => t.id === beforeId);
  // An unknown anchor (deleted meanwhile) means the bottom, not index 0.
  const at = anchor === -1 ? rest.length : anchor;
  // Explicitly optional: tsconfig has no noUncheckedIndexedAccess, so an index access
  // types as Todo although both ends of the list really do yield undefined here.
  const before: Todo | undefined = at > 0 ? rest[at - 1] : undefined;
  const after: Todo | undefined = at < rest.length ? rest[at] : undefined;

  if (before === undefined) {
    return after === undefined ? Date.now() : rankOf(after) - ORDER_STEP;
  }

  return after === undefined ? rankOf(before) + ORDER_STEP : (rankOf(before) + rankOf(after)) / 2;
}

/**
 * Whether the pointer sits in the upper half of a card, i.e. the drop inserts ABOVE
 * it. Kept out of the component so the geometry is testable without a DOM.
 */
export function dropsAbove(clientY: number, rect: { top: number; height: number }): boolean {
  return clientY < rect.top + rect.height / 2;
}
