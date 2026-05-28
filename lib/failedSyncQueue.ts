import { type SyncQueueEntry, PREFIX, safeGetJson } from './localCache';
import { CACHE_TTL_MS } from './constants';

const FAILED_SYNC_KEY = `${PREFIX}sync-failed`;

export function getFailedSyncQueue(): SyncQueueEntry[] {
  const raw = safeGetJson(FAILED_SYNC_KEY);
  return Array.isArray(raw) ? (raw as SyncQueueEntry[]) : [];
}

export function addToFailedSync(entry: SyncQueueEntry): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  // Dedup by (entityType, entityId): a later failure for the same entity
  // overwrites the earlier one. Only the most recent failed action is
  // informative — the row either still exists (CREATE/UPDATE) or it doesn't
  // (DELETE never reaches this queue because the tombstone in
  // deleteNote*Offline + DELETE 404 → 'ok' in replayMutation guarantee it).
  const queue = getFailedSyncQueue();
  const idx = queue.findIndex((e) => e.entityType === entry.entityType && e.entityId === entry.entityId);
  if (idx >= 0) {
    queue[idx] = entry;
  } else {
    queue.push(entry);
  }

  try {
    localStorage.setItem(FAILED_SYNC_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full — best-effort
  }
}

export function getFailedSyncCount(): number {
  return getFailedSyncQueue().length;
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

export function cleanExpiredFailedEntries(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const queue = getFailedSyncQueue();
  const now = Date.now();
  const kept = queue.filter((e) => now - new Date(e.timestamp).getTime() < CACHE_TTL_MS);
  if (kept.length < queue.length) {
    if (kept.length === 0) {
      localStorage.removeItem(FAILED_SYNC_KEY);
    } else {
      try {
        localStorage.setItem(FAILED_SYNC_KEY, JSON.stringify(kept));
      } catch {
        // best-effort
      }
    }
  }
}
