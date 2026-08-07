import { type SyncQueueEntry, getSyncQueue, nextSyncSeq, sameSyncEntry, setSyncQueue } from '@/lib/localCache';
import { addToFailedSync, buildFailure, markFailure, removeFromFailedSync } from '@/lib/failedSyncQueue';
import { replayMutation } from '@/lib/syncReplay';
import { SYNC_ACTION, SYNC_MAX_RETRIES } from '@/lib/constants';

let processing = false;

export function enqueueMutation(entry: SyncQueueEntry): void {
  const queue = getSyncQueue();
  const seq = nextSyncSeq();

  // Dedup: only replaces entries with the SAME action (e.g. update+update).
  // Different actions for the same entity (create, update, delete) intentionally
  // coexist — the FIFO queue replays them in order so create→update→delete works.
  const existingIdx = queue.findIndex(
    (e) => e.entityType === entry.entityType && e.entityId === entry.entityId && e.action === entry.action,
  );

  if (existingIdx >= 0) {
    queue[existingIdx] = { ...entry, seq };
  } else {
    queue.push({ ...entry, seq });
  }

  setSyncQueue(queue);
}

export function hasPendingForEntity(entityId: string): boolean {
  return getSyncQueue().some((e) => e.entityId === entityId);
}

export function hasPendingCreate(entityId: string): boolean {
  return getSyncQueue().some((e) => e.entityId === entityId && e.action === SYNC_ACTION.CREATE);
}

export function clearPendingForEntity(entityId: string): void {
  const queue = getSyncQueue().filter((e) => e.entityId !== entityId);
  setSyncQueue(queue);
}

export function getPendingCount(): number {
  return getSyncQueue().length;
}

/**
 * Puts a failed entry back into the pending queue for another attempt. The retry
 * budget and the recorded failure are dropped BY CONSTRUCTION — the transport
 * fields are copied explicitly rather than spread.
 *
 * The entry deliberately stays in the failed queue: processSyncQueue clears it
 * on success and addToFailedSync overwrites it on a second failure, so there is
 * never a window in which the unsynced content has no record at all.
 *
 * Callers must check hasPendingForEntity first. Re-queuing while a newer
 * mutation waits would either overwrite that newer payload (enqueueMutation
 * dedups on the same action) or replay out of order (a re-queued create lands
 * behind a pending update → 404).
 *
 * The one exception is a 'not-recorded' entry: it IS the pending entry, parked
 * with a spent retry budget, so nothing will ever replay it on its own. Here the
 * enqueueMutation dedup is the mechanism rather than the hazard — it replaces the
 * entry in place, which is what clears retryCount and failure.
 */
export function requeueFailedEntry(entry: SyncQueueEntry): void {
  enqueueMutation({
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    payload: entry.payload,
    timestamp: entry.timestamp,
  });
}

function removeHeadIfMatches(current: SyncQueueEntry): void {
  const fresh = getSyncQueue();
  if (fresh.length > 0 && sameSyncEntry(fresh[0], current)) {
    fresh.shift();
    setSyncQueue(fresh);
  }
}

/**
 * Applies a patch to the pending head, re-reading the queue first so a
 * concurrently enqueued mutation is never clobbered.
 *
 * The patch is a function of the FRESH head, not a literal: the retry paths must
 * increment the persisted retryCount rather than the one on the stale `current`.
 * Fields the patch omits are preserved — which is how a thrown attempt keeps the
 * previous `failure` so a later give-up still reports the real HTTP status.
 */
function patchHead(current: SyncQueueEntry, patch: (head: SyncQueueEntry) => Partial<SyncQueueEntry>): void {
  const fresh = getSyncQueue();
  if (fresh.length > 0 && sameSyncEntry(fresh[0], current)) {
    fresh[0] = { ...fresh[0], ...patch(fresh[0]) };
    setSyncQueue(fresh);
  }
}

const bumpRetry = (head: SyncQueueEntry): Partial<SyncQueueEntry> => ({
  retryCount: (head.retryCount ?? 0) + 1,
});

export async function processSyncQueue(): Promise<void> {
  if (processing) {
    return;
  }

  processing = true;

  try {
    // Re-read from localStorage on every iteration so entries enqueued
    // concurrently (e.g. user action during an in-flight replay) are never
    // silently overwritten.
    let queue = getSyncQueue();

    while (queue.length > 0) {
      const entry = queue[0];

      if ((entry.retryCount ?? 0) >= SYNC_MAX_RETRIES) {
        console.error('Sync entry exceeded max retries, moving to failed:', entry);
        if (!addToFailedSync(markFailure(entry, 'max-retries'))) {
          // localStorage full. Leave the entry at the pending head — dropping it
          // here would destroy the only record of the unsynced content — and
          // mark it so the inspector can surface it. No budget change needed:
          // this branch runs before the replay, so it issues no request and
          // simply re-marks on every drain until storage frees up.
          patchHead(entry, (head) => ({ failure: buildFailure(head, 'not-recorded') }));
          break;
        }

        removeHeadIfMatches(entry);
        queue = getSyncQueue();
        continue;
      }

      try {
        const result = await replayMutation(entry);

        if (result.outcome === 'offline') {
          // Network unreachable (offline) — pause WITHOUT consuming the retry
          // budget. Offline is not a failure; the mutation must wait for
          // reconnection, not be declared failed after N futile offline polls.
          break;
        } else if (result.outcome === 'discard') {
          console.error('Sync entry not retryable, moving to failed:', entry);
          if (!addToFailedSync(markFailure(entry, 'non-retryable', result))) {
            // localStorage full: the entry has to stay at the pending head as the
            // only surviving record. Burn a retry so it converges on the
            // max-retries branch above, which issues no request — otherwise every
            // drain would re-send a mutation already known to be rejected, with
            // the rest of the queue blocked behind it.
            patchHead(entry, (head) => ({
              ...bumpRetry(head),
              failure: buildFailure(head, 'not-recorded', result),
            }));
            break;
          }

          removeHeadIfMatches(entry);
          queue = getSyncQueue();
        } else if (result.outcome === 'retry') {
          patchHead(entry, (head) => ({
            ...bumpRetry(head),
            failure: buildFailure(head, 'server-error', result),
          }));
          queue = getSyncQueue();
          break;
        } else {
          // Any later successful op for this id means the client has moved on,
          // so drop any earlier failure marker for the same entity. Concrete
          // cases this covers: successful DELETE clears a failed CREATE/UPDATE;
          // a fresh UPDATE that finally succeeds clears its own prior failure.
          // We deliberately match by id, not action.
          removeFromFailedSync(entry.entityType, entry.entityId);
          removeHeadIfMatches(entry);
          queue = getSyncQueue();
        }
      } catch {
        patchHead(entry, bumpRetry);
        queue = getSyncQueue();
        break;
      }
    }
  } finally {
    processing = false;
  }
}
