import {
  PREFIX,
  NOTES_LIST_KEY,
  TODOS_KEY,
  CACHED_AT_PREFIX,
  NOTE_PREFIX,
  cachedAtKey,
  safeGetJson,
  safeSetJson,
  getSyncQueue,
} from "./localCache";

const TOMBSTONES_KEY = `${PREFIX}tombstones`;
const SYNC_QUEUE_KEY = `${PREFIX}sync-queue`;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

// --- Merge ---

/**
 * Merge server (primary) and localStorage (cached) arrays by `id`.
 * For each item: pick whichever has the newer `updatedAt`.
 * Items only in cached (offline-created) are appended.
 * Items with a pending delete in the sync queue are excluded entirely.
 */
export function mergeById<T extends { id: string; updatedAt: string }>(
  primary: T[],
  cached: T[],
): T[] {
  const pendingDeletes = pendingDeleteIds();
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

  // Append items only in localStorage (created offline)
  for (const item of cached) {
    if (!seen.has(item.id) && !pendingDeletes.has(item.id)) {
      merged.push(item);
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

function getTombstoneMap(): Record<string, number> {
  const raw = safeGetJson(TOMBSTONES_KEY);
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, number>;
  }

  return {};
}

function getTombstones(): Set<string> {
  const map = getTombstoneMap();
  const now = Date.now();
  return new Set(
    Object.entries(map)
      .filter(([, ts]) => now - ts < TTL_MS)
      .map(([id]) => id),
  );
}

function cleanTombstones(): void {
  const map = getTombstoneMap();
  const now = Date.now();
  const cleaned: Record<string, number> = {};
  for (const [id, ts] of Object.entries(map)) {
    if (now - ts < TTL_MS) {
      cleaned[id] = ts;
    }
  }
  if (Object.keys(cleaned).length < Object.keys(map).length) {
    safeSetJson(TOMBSTONES_KEY, cleaned);
  }
}

// --- Sync Queue Helpers ---

function pendingDeleteIds(): Set<string> {
  const queue = getSyncQueue();
  return new Set(queue.filter((e) => e.action === 'delete').map((e) => e.entityId));
}

function pendingEntityIds(): Set<string> {
  const queue = getSyncQueue();
  return new Set(queue.map((e) => e.entityId));
}

export function cleanExpiredEntries(): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  cleanTombstones();
  const now = Date.now();
  const pending = pendingEntityIds();
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null) {
      continue;
    }

    if (!key.startsWith(PREFIX)) {
      continue;
    }

    // Never delete sync queue
    if (key === SYNC_QUEUE_KEY) {
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
      if (age > TTL_MS) {
        keysToRemove.push(key);
        keysToRemove.push(cachedAtKey(key));
      }
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}
