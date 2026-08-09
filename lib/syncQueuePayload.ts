import type { SyncQueueEntry } from '@/lib/localCache';
import { SYNC_ACTION } from '@/lib/constants';

/**
 * A write that succeeded: which entity it touched, and what it carried.
 *
 * The single declaration — failedSyncQueue needs the two id fields to find the
 * matching record, subtractAckedKeys ignores them. Two same-named types with
 * different shapes across modules that import each other is worse than one type
 * with a field a callee does not read.
 */
export type AckedWrite = Pick<SyncQueueEntry, 'entityType' | 'entityId' | 'action' | 'payload'>;

/**
 * Collapses a new mutation onto a queued one with the same (entity, action).
 *
 * UPDATE payloads are partial — `{quadrant}` from a drag, `{completed}` from the
 * checkbox — so replacing wholesale silently drops the earlier field: offline,
 * moving a todo and then ticking it off used to send only `completed`.
 *
 * Merging is correct for both entities because an absent key NEVER means
 * "clear": fsNotes.updateNote is `input.x ?? existing.x`, and fsTodos.updateTodo
 * strips nulls from the merged object. So omission can only mean "unchanged".
 * A later explicit null still wins (clear beats an older value), and an earlier
 * null survives a later payload that omits its key — that clear has not reached
 * the server either.
 *
 * CREATE carries the whole entity and DELETE carries `{}`, so both replace.
 *
 * retryCount/failure are deliberately NOT inherited: a fresh user change earns a
 * fresh retry budget. That is the existing behaviour, and the 'not-recorded'
 * unparking in processSyncQueue relies on it.
 */
export function foldQueuedEntry(existing: SyncQueueEntry, incoming: SyncQueueEntry): SyncQueueEntry {
  if (existing.action !== SYNC_ACTION.UPDATE || incoming.action !== SYNC_ACTION.UPDATE) {
    return incoming;
  }

  return { ...incoming, payload: { ...existing.payload, ...incoming.payload } };
}

/**
 * A direct write just succeeded — decide what is left of an earlier FAILED entry
 * for the same entity.
 *
 * removeFromFailedSync keys only on (entityType, entityId), so a successful
 * partial UPDATE would erase a failed UPDATE carrying *different* fields: the
 * inspector loses a change that never reached the server. Only the keys the
 * server actually received are cleared here; a remainder keeps its row.
 *
 * Every other combination is a full ack — a successful UPDATE proves the row
 * exists (so a failed CREATE is stale), a CREATE carries the whole entity, and
 * once a DELETE lands a pending field change is moot.
 *
 * Returns null when nothing is left and the entry should be dropped.
 */
export function subtractAckedKeys(failed: SyncQueueEntry, acked: AckedWrite): SyncQueueEntry | null {
  if (failed.action !== SYNC_ACTION.UPDATE || acked.action !== SYNC_ACTION.UPDATE) {
    return null;
  }

  const remaining = Object.fromEntries(
    Object.entries(failed.payload).filter(([key]) => !(key in acked.payload)),
  );

  return Object.keys(remaining).length === 0 ? null : { ...failed, payload: remaining };
}
