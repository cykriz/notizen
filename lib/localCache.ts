import type { Note, NoteSummary, SyncAction, SyncEntityType, SyncFailureInfo, Todo } from '@/lib/types';
import { NoteResponseSchema, parseNoteSummaryRows, parseTodoRows } from '@/lib/schemas';
import { readLocal, removeLocal, writeLocal } from '@/lib/localStorageState';

export const PREFIX = 'notizen:';
export const NOTES_LIST_KEY = `${PREFIX}notes-list`;
export const TODOS_KEY = `${PREFIX}todos`;
export const SYNC_QUEUE_KEY = `${PREFIX}sync-queue`;
export const CACHED_AT_PREFIX = `${PREFIX}cached-at:`;
export const NOTE_PREFIX = `${PREFIX}note:`;
export const DRAFT_PREFIX = `${PREFIX}draft:`;

function noteKey(id: string): string {
  return `${NOTE_PREFIX}${id}`;
}

function draftKey(id: string): string {
  return `${DRAFT_PREFIX}${id}`;
}

export function cachedAtKey(key: string): string {
  return `${CACHED_AT_PREFIX}${key}`;
}

export function safeGetJson(key: string): unknown {
  const raw = readLocal(key);
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    // Corrupt entry — drop it so the next write starts clean. removeLocal, never
    // localStorage.removeItem: a throwing storage getter would throw again from
    // inside this catch and the error would escape the try after all.
    removeLocal(key);
    return null;
  }
}

/**
 * Serialise and store without the cached-at stamp, reporting whether it landed.
 *
 * writeLocal itself cannot throw; the try covers only JSON.stringify and keeps the
 * contract every write path here had before: a best-effort cache write never
 * raises at its caller, whatever it is handed.
 */
export function setJsonRaw(key: string, value: unknown): boolean {
  try {
    return writeLocal(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function safeSetJson(key: string, value: unknown): void {
  // The stamp is written only once the value itself is in: a fresh cached-at over
  // a value that failed to store (localStorage full or unavailable) would keep the
  // stale entry alive past its TTL. Acceptable for a personal NAS app either way —
  // data survives in React state; the cache is best-effort.
  if (setJsonRaw(key, value)) {
    writeLocal(cachedAtKey(key), new Date().toISOString());
  }
}

// --- Notes List ---

export function getCachedNotesList(): NoteSummary[] {
  // Row-wise: a single malformed row must not discard the whole list, which for
  // offline-created notes is the only copy that exists. See parseNoteSummaryRows.
  return parseNoteSummaryRows(safeGetJson(NOTES_LIST_KEY));
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

// --- Draft (unsaved editor state, separate from sync cache) ---

export function getDraft(id: string): { title: string; content: string } | null {
  const raw = safeGetJson(draftKey(id)) as Record<string, unknown> | null;
  if (raw === null || typeof raw.title !== 'string' || typeof raw.content !== 'string') {
    return null;
  }

  return { title: raw.title, content: raw.content };
}

export function setDraft(id: string, title: string, content: string): void {
  // Unstamped on purpose: cleanExpiredEntries ties a draft's lifetime to its note,
  // not to the cache TTL, so a cached-at key would only invite expiry.
  setJsonRaw(draftKey(id), { title, content });
}

export function clearDraft(id: string): void {
  removeLocal(draftKey(id));
}

export function removeCachedNote(id: string): void {
  const key = noteKey(id);
  removeLocal(key);
  removeLocal(cachedAtKey(key));
}

// --- Todos ---

export function getCachedTodos(): Todo[] {
  // Row-wise, and rescuing pre-cd9392c 'delegate' rows: the previous whole-array
  // parse turned one stale row into a total cache wipe. See parseTodoRows.
  return parseTodoRows(safeGetJson(TODOS_KEY));
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
  retryCount?: number;
  seq?: string;
  // Most recent replay failure. On a PENDING entry this is the last retryable
  // attempt's error, so a later max-retries give-up still knows the real HTTP
  // status (five 503s would otherwise land in the failed queue with no status at
  // all). On a FAILED entry it is the terminal cause. Absent on legacy entries.
  failure?: SyncFailureInfo;
}

export function nextSyncSeq(): string {
  return crypto.randomUUID();
}

/**
 * Same queued mutation? Prefers `seq`, falling back to the identity triple for
 * entries persisted before seq existed.
 *
 * Lives here because both syncQueue (matching the head before patching it) and
 * failedSyncDiscard (removing a stuck entry without touching a newer mutation for
 * the same entity) need it, and importing either from the other would close a cycle.
 */
export function sameSyncEntry(a: SyncQueueEntry, b: SyncQueueEntry): boolean {
  if (a.seq !== undefined && b.seq !== undefined) {
    return a.seq === b.seq;
  }

  return a.entityType === b.entityType && a.entityId === b.entityId && a.action === b.action;
}

export function getSyncQueue(): SyncQueueEntry[] {
  return (safeGetJson(SYNC_QUEUE_KEY) as SyncQueueEntry[] | null) ?? [];
}

export function setSyncQueue(queue: SyncQueueEntry[]): void {
  // localStorage full — queue stays in memory via getSyncQueue() calls.
  // Next successful write persists it.
  setJsonRaw(SYNC_QUEUE_KEY, queue);
}
