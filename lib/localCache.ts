import type { Note, NoteSummary, SyncAction, SyncEntityType, Todo } from "@/lib/types";
import { NoteSummaryArraySchema, NoteResponseSchema, TodoArraySchema } from "@/lib/schemas";

const PREFIX = "notizen:";
const NOTES_LIST_KEY = `${PREFIX}notes-list`;
const TODOS_KEY = `${PREFIX}todos`;
const SYNC_QUEUE_KEY = `${PREFIX}sync-queue`;
const CACHED_AT_PREFIX = `${PREFIX}cached-at:`;
const NOTE_PREFIX = `${PREFIX}note:`;
const TOMBSTONES_KEY = `${PREFIX}tombstones`;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

function noteKey(id: string): string {
  return `${NOTE_PREFIX}${id}`;
}

function cachedAtKey(key: string): string {
  return `${CACHED_AT_PREFIX}${key}`;
}

function safeGetJson(key: string): unknown {
  if (typeof localStorage === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return null;
    }

    return JSON.parse(raw) as unknown;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function safeSetJson(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(cachedAtKey(key), new Date().toISOString());
  } catch {
    // localStorage full or unavailable — acceptable for personal NAS app.
    // Data survives in React state; cache is best-effort.
  }
}

// --- Notes List ---

export function getCachedNotesList(): NoteSummary[] {
  const raw = safeGetJson(NOTES_LIST_KEY);
  if (raw === null) {
    return [];
  }

  const parsed = NoteSummaryArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function setCachedNotesList(notes: NoteSummary[]): void {
  safeSetJson(NOTES_LIST_KEY, notes);
}

// --- Individual Note ---

export function getCachedNote(id: string): Note | null {
  const raw = safeGetJson(noteKey(id));
  if (raw === null) {
    return null;
  }

  const parsed = NoteResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function setCachedNote(note: Note): void {
  safeSetJson(noteKey(note.id), note);
}

export function removeCachedNote(id: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  const key = noteKey(id);
  localStorage.removeItem(key);
  localStorage.removeItem(cachedAtKey(key));
}

// --- Todos ---

export function getCachedTodos(): Todo[] {
  const raw = safeGetJson(TODOS_KEY);
  if (raw === null) {
    return [];
  }

  const parsed = TodoArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function setCachedTodos(todos: Todo[]): void {
  safeSetJson(TODOS_KEY, todos);
}

// --- Sync Queue ---

export interface SyncQueueEntry {
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  payload: Record<string, unknown>;
  timestamp: string;
}

export function getSyncQueue(): SyncQueueEntry[] {
  return (safeGetJson(SYNC_QUEUE_KEY) as SyncQueueEntry[] | null) ?? [];
}

export function setSyncQueue(queue: SyncQueueEntry[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full — queue stays in memory via getSyncQueue() calls.
    // Next successful write persists it.
  }
}

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
    merged.push(localItem !== undefined && new Date(localItem.updatedAt).getTime() > new Date(serverItem.updatedAt).getTime() ? localItem : serverItem);
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
