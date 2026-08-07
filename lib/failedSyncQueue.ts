import { type SyncQueueEntry, PREFIX, getSyncQueue, safeGetJson } from './localCache';
import { SYNC_MAX_RETRIES } from './constants';
import type { SyncFailureInfo, SyncFailureReason } from './types';

const FAILED_SYNC_KEY = `${PREFIX}sync-failed`;

export function getFailedSyncQueue(): SyncQueueEntry[] {
  const raw = safeGetJson(FAILED_SYNC_KEY);
  return Array.isArray(raw) ? (raw as SyncQueueEntry[]) : [];
}

/**
 * Builds the failure record for an entry that just stopped being retried.
 *
 * `attempt` carries the status/body of the rejecting response. When it has none
 * — a give-up after N retries — the values recorded on the pending entry by the
 * last retryable attempt are inherited; that is how a 'max-retries' entry still
 * knows it was five 503s rather than reporting an unknown cause.
 *
 * `attempts` is capped at SYNC_MAX_RETRIES rather than being retryCount + 1:
 * the give-up check in processSyncQueue runs BEFORE the replay, so on that path
 * the last counted attempt never happened and reporting 6 would contradict
 * "gave up after 5 attempts". The cap gets this right for every reason,
 * including a 'not-recorded' marker written on top of a spent budget.
 */
export function buildFailure(
  entry: SyncQueueEntry,
  reason: SyncFailureReason,
  attempt?: { status?: number; message?: string },
): SyncFailureInfo {
  return {
    reason,
    status: attempt?.status ?? entry.failure?.status,
    message: attempt?.message ?? entry.failure?.message,
    failedAt: new Date().toISOString(),
    attempts: Math.min((entry.retryCount ?? 0) + 1, SYNC_MAX_RETRIES),
  };
}

/** Stamps a terminal failure onto an entry before it moves to the failed queue. */
export function markFailure(
  entry: SyncQueueEntry,
  reason: SyncFailureReason,
  attempt?: { status?: number; message?: string },
): SyncQueueEntry {
  return { ...entry, failure: buildFailure(entry, reason, attempt) };
}

/**
 * Records a permanently failed mutation. Returns false when it could not be
 * persisted (localStorage full) — the caller MUST then leave the entry in the
 * pending queue, because otherwise it is dropped from both queues and the only
 * record of the unsynced content is gone.
 */
export function addToFailedSync(entry: SyncQueueEntry): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  // Dedup by (entityType, entityId): a later failure for the same entity
  // overwrites the earlier one. Only the most recent failed action is
  // informative — the row either still exists (CREATE/UPDATE) or it doesn't.
  // A persistently 5xx-ing DELETE does reach this queue via the max-retries
  // path; the tombstone keeps its row hidden, and the inspector lists it.
  const queue = getFailedSyncQueue();
  const idx = queue.findIndex((e) => e.entityType === entry.entityType && e.entityId === entry.entityId);
  if (idx >= 0) {
    queue[idx] = entry;
  } else {
    queue.push(entry);
  }

  try {
    localStorage.setItem(FAILED_SYNC_KEY, JSON.stringify(queue));
    return true;
  } catch {
    return false;
  }
}

export function removeFromFailedSync(entityType: string, entityId: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const queue = getFailedSyncQueue();
  const kept = queue.filter((e) => !(e.entityType === entityType && e.entityId === entityId));
  if (kept.length === queue.length) {
    return;
  }

  try {
    if (kept.length === 0) {
      localStorage.removeItem(FAILED_SYNC_KEY);
    } else {
      localStorage.setItem(FAILED_SYNC_KEY, JSON.stringify(kept));
    }
  } catch {
    // best-effort
  }
}

export function clearFailedSyncQueue(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(FAILED_SYNC_KEY);
}

/**
 * Pending entries that could not be recorded in the failed queue because
 * localStorage was full (marked by processSyncQueue). They stay at the pending
 * head as the surviving record, but nothing else would ever show them: the
 * indicator would sit on "Synchronisiere…" forever while the retry loop burns a
 * cycle every 5 minutes. Matching on the explicit marker rather than on a spent
 * retryCount avoids mislabelling an entry the sync loop simply has not reached.
 */
export function getStuckPendingEntries(): SyncQueueEntry[] {
  return getSyncQueue().filter((e) => e.failure?.reason === 'not-recorded');
}

/**
 * Collapses entries that describe the same entity, later wins.
 *
 * Each queue dedups on (entityType, entityId) internally, but their union does
 * not: when a recorded failure for X already exists and a newer mutation for X
 * is then marked 'not-recorded' (the quota path could not overwrite the record),
 * X appears twice — duplicate React keys and a doubled indicator count. Callers
 * pass the stuck entries last because they are the newer record.
 */
export function dedupeByEntity(entries: SyncQueueEntry[]): SyncQueueEntry[] {
  const byKey = new Map<string, SyncQueueEntry>();
  for (const entry of entries) {
    byKey.set(`${entry.entityType}:${entry.entityId}`, entry);
  }

  return [...byKey.values()];
}

/** Everything the inspector should list: recorded failures plus stuck entries. */
export function getInspectableEntries(): SyncQueueEntry[] {
  return dedupeByEntity([...getFailedSyncQueue(), ...getStuckPendingEntries()]);
}

export function getInspectableCount(): number {
  return getInspectableEntries().length;
}
