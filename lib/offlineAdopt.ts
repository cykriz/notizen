// The shared half of adopting a server response into a cached list. Pure, so it
// unit-tests without a localStorage shim — same reason syncQueuePayload is split out.

/**
 * Replaces the row with this id, or inserts it. `at` decides where a new row lands.
 *
 * The shared half of adopting a server response, and the reason both entities do
 * it at all: the server stamps its own `updatedAt`, so a cache still holding the
 * client's makes the next `X-Expected-UpdatedAt` a guaranteed 409 — and the
 * mutation is then rejected on every subsequent edit.
 *
 * Callers pass the CURRENT cache, not the list captured when the write started.
 * React state only updates on re-render and hasPendingForEntity sees the queue
 * but not in-flight requests, so two quick edits both go direct off the same
 * pre-state; writing back a whole stale snapshot would undo the other one,
 * including its changes to unrelated rows.
 *
 * What remains is narrow and self-correcting: for the SAME row, two in-flight
 * writes resolve last-response-wins in the cache, which can briefly disagree with
 * the server's last-write-wins. Both carry a real server `updatedAt`, so the next
 * refresh reconciles it without a conflict loop.
 */
export function upsertById<T extends { id: string }>(
  current: T[],
  row: T,
  at: 'start' | 'end',
): T[] {
  if (current.some((r) => r.id === row.id)) {
    return current.map((r) => (r.id === row.id ? row : r));
  }

  return at === 'start' ? [row, ...current] : [...current, row];
}
