import {
  PREFIX,
  NOTES_LIST_KEY,
  TODOS_KEY,
  CACHED_AT_PREFIX,
  NOTE_PREFIX,
  cachedAtKey,
  safeGetJson,
  safeSetJson,
  SYNC_QUEUE_KEY,
  DRAFT_PREFIX,
  getSyncQueue,
} from './localCache';
import { getFailedSyncQueue } from './failedSyncQueue';
import { CACHE_TTL_MS } from './constants';

const TOMBSTONES_KEY = `${PREFIX}tombstones`;

// --- Merge ---

/**
 * Merge server (primary) and localStorage (cached) arrays by `id`.
 * For each item: pick whichever has the newer `updatedAt`.
 * Cache-only items are kept only if they have a pending OR failed sync entry
 * (failed CREATE/UPDATE stay visible until that entry is retried or discarded);
 * otherwise they were likely deleted externally and are dropped.
 * Items with a pending delete or a tombstone are excluded entirely — this is
 * why failed DELETEs never surface (the tombstone is added before the enqueue).
 */
export function mergeById<T extends { id: string; updatedAt: string }>(
  primary: T[],
  cached: T[],
): T[] {
  const queue = getSyncQueue();
  const pendingDeletes = new Set(queue.filter((e) => e.action === 'delete').map((e) => e.entityId));
  const pendingAll = new Set([...queue, ...getFailedSyncQueue()].map((e) => e.entityId));
  const tombstones = getTombstones();
  const cachedMap = new Map(cached.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const serverItem of primary) {
    seen.add(serverItem.id);
    if (pendingDeletes.has(serverItem.id) || tombstones.has(serverItem.id)) {
      continue;
    }

    const localItem = cachedMap.get(serverItem.id);
    const localIsNewer = localItem !== undefined
      && new Date(localItem.updatedAt).getTime() > new Date(serverItem.updatedAt).getTime();
    merged.push(localIsNewer ? localItem : serverItem);
  }

  // Append cache-only items (not in `seen`) iff they have any pending or failed
  // sync entry — failed CREATEs and UPDATEs stay visible until that entry is
  // retried or discarded. Failed DELETEs never surface: deleteNoteOffline /
  // deleteTodoOffline always add a tombstone before enqueuing, and tombstones
  // win over failed entries. Items with no pending/failed entry were likely
  // deleted externally and are dropped.
  for (const item of cached) {
    if (!seen.has(item.id) && !pendingDeletes.has(item.id) && !tombstones.has(item.id)) {
      if (pendingAll.has(item.id)) {
        merged.push(item);
      }
    }
  }

  return merged;
}

// --- Tombstones (track deletes so stale SW-cached pages don't revive them) ---
// Stored as { [id]: timestamp }. Expire after 7 days (matches SW cache TTL).

export function addTombstone(id: string): void {
  const map = getTombstoneMap();
  map[id] = Date.now();
  safeSetJson(TOMBSTONES_KEY, map);
}

// Clear a tombstone — used on restore-from-trash so mergeById stops hiding the
// id and the restored note/todo reappears in the active list.
export function removeTombstone(id: string): void {
  const map = getTombstoneMap();
  if (id in map) {
    const { [id]: _drop, ...rest } = map;
    safeSetJson(TOMBSTONES_KEY, rest);
  }
}

function getTombstoneMap(): Record<string, number> {
  const raw = safeGetJson(TOMBSTONES_KEY);
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, number>;
  }

  return {};
}

function getTombstones(): Set<string> {
  const map = getTombstoneMap();
  const now = Date.now();
  return new Set(
    Object.entries(map)
      .filter(([, ts]) => now - ts < CACHE_TTL_MS)
      .map(([id]) => id),
  );
}

function cleanTombstones(): void {
  const map = getTombstoneMap();
  const now = Date.now();
  const cleaned: Record<string, number> = {};
  for (const [id, ts] of Object.entries(map)) {
    if (now - ts < CACHE_TTL_MS) {
      cleaned[id] = ts;
    }
  }
  if (Object.keys(cleaned).length < Object.keys(map).length) {
    safeSetJson(TOMBSTONES_KEY, cleaned);
  }
}

// --- Sync Queue Helpers ---

function pendingEntityIds(): Set<string> {
  const queue = getSyncQueue();
  const failed = getFailedSyncQueue();
  return new Set([...queue, ...failed].map((e) => e.entityId));
}

export function cleanExpiredEntries(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  cleanTombstones();
  // Failed entries deliberately never expire — see discardEntry. Expiring
  // them here would strip their own pendingEntityIds() protection in this very
  // pass and delete notizen:note:<id> + draft with no user action at all.
  const now = Date.now();
  const pending = pendingEntityIds();
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Never delete the sync queue itself
    if (key === null || !key.startsWith(PREFIX) || key === SYNC_QUEUE_KEY) {
      continue;
    }

    // Keep drafts only while their note still exists or has pending sync
    if (key.startsWith(DRAFT_PREFIX)) {
      const entityId = key.slice(DRAFT_PREFIX.length);
      if (pending.has(entityId) || localStorage.getItem(`${NOTE_PREFIX}${entityId}`) !== null) {
        continue;
      }

      keysToRemove.push(key);
      continue;
    }

    // Skip cached-at metadata keys (they get cleaned with their parent)
    if (key.startsWith(CACHED_AT_PREFIX)) {
      continue;
    }

    // Skip list keys when any sync mutations are pending — they contain
    // offline-created items that would be lost if the key were deleted.
    if (pending.size > 0 && (key === NOTES_LIST_KEY || key === TODOS_KEY)) {
      continue;
    }

    // Skip individual note entries with pending sync mutations
    if (key.startsWith(NOTE_PREFIX)) {
      const entityId = key.slice(NOTE_PREFIX.length);
      if (pending.has(entityId)) {
        continue;
      }
    }

    const cachedAt = localStorage.getItem(cachedAtKey(key));
    if (cachedAt !== null) {
      const age = now - new Date(cachedAt).getTime();
      if (age > CACHE_TTL_MS) {
        keysToRemove.push(key);
        keysToRemove.push(cachedAtKey(key));
      }
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}
