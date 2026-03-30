import type { Note, NoteSummary, SyncAction, SyncEntityType, Todo } from "@/lib/types";
import { NoteSummaryArraySchema, NoteResponseSchema, TodoArraySchema } from "@/lib/schemas";

export const PREFIX = "notizen:";
export const NOTES_LIST_KEY = `${PREFIX}notes-list`;
export const TODOS_KEY = `${PREFIX}todos`;
const SYNC_QUEUE_KEY = `${PREFIX}sync-queue`;
export const CACHED_AT_PREFIX = `${PREFIX}cached-at:`;
export const NOTE_PREFIX = `${PREFIX}note:`;

function noteKey(id: string): string {
  return `${NOTE_PREFIX}${id}`;
}

export function cachedAtKey(key: string): string {
  return `${CACHED_AT_PREFIX}${key}`;
}

export function safeGetJson(key: string): unknown {
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

export function safeSetJson(key: string, value: unknown): void {
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

