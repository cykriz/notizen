// INVARIANT: no DOM globals in this file. It is reachable from worker/ — via
// @/lib/constants (sw.ts, swWarm.ts, swStrategies.ts) and directly from
// worker/swPrecache.ts — and worker/tsconfig.json has lib: ["webworker",
// "esnext"] on purpose, so the service worker never gets window/document types.
// A DOM reference here fails `bun run typecheck` (the worker project), which is
// exactly how `SpeechSynthesisVoice` used to sit here unnoticed. DOM-typed
// shapes belong in a leaf module the SW cannot reach — see lib/ttsTypes.ts.
export interface NoteSummary {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
  tags: string[];
  pinned: boolean;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  relativePath: string;
}

export interface Note extends NoteSummary {
  content: string;
  attachments: Attachment[];
}

export type PreviewMode = 'edit' | 'preview';

// TodoQuadrant is derived from a const value via `typeof`, so the type lives next
// to that value. Re-exported here (unlike the read-aloud types, which moved to
// lib/ttsTypes.ts) for two reasons: this file uses it itself below — QuadrantMeta
// and Todo — so the import exists either way, and lib/constants.ts is already in
// the service worker's type program and DOM-free, so the edge costs nothing.
import type { TodoQuadrant } from './constants';
export type { TodoQuadrant };

export type SyncEntityType = 'note' | 'todo';
export type SyncAction = 'create' | 'update' | 'delete';

// Why a queued mutation was abandoned.
//   'server-error'  — transient marker on a still-PENDING entry after a retryable
//                     (5xx) attempt; never a terminal state.
//   'max-retries'   — SYNC_MAX_RETRIES attempts spent.
//   'non-retryable' — the server answered with a definitive non-5xx error.
//   'not-recorded'  — the entry could not be written to the failed queue at all
//                     (localStorage full); it stays at the head of the pending
//                     queue as the surviving record. See addToFailedSync.
export type SyncFailureReason = 'server-error' | 'max-retries' | 'non-retryable' | 'not-recorded';

// Snapshot of the last failed replay attempt. Optional throughout: entries
// persisted by older builds carry no `failure`, so every consumer must handle
// `undefined`. Read defensively — getFailedSyncQueue casts without validating.
export interface SyncFailureInfo {
  reason: SyncFailureReason;
  // HTTP status of the rejecting response. Absent when no response arrived.
  status?: number;
  // Response body, trimmed to SYNC_ERROR_BODY_MAX. Diagnostic only — the
  // user-facing German text is derived from `status`, never from this.
  message?: string;
  failedAt: string;
  // Attempts actually made. NOT retryCount + 1 on the max-retries path: the
  // give-up check sits before the replay, so the last counted attempt never ran.
  attempts: number;
}

export interface QuadrantMeta {
  key: TodoQuadrant;
  label: string;
  description: string;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  linkedNoteIds?: string[];
  quadrant: TodoQuadrant;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  // ISO timestamp set when the todo is moved to the trash (soft-delete flag).
  // listTodos/getTodo hide entries carrying it, so it never reaches the active client cache.
  trashedAt?: string;
}

// Items in the trash always carry a trashedAt timestamp (used for display + auto-purge).
export type TrashedNote = NoteSummary & { trashedAt: string };
export type TrashedTodo = Todo & { trashedAt: string };

export interface UserSettings {
  retentionDays: number;
}

// What the service worker still lacks after a precache check + repair pass.
// Shared by worker/swPrecache.ts and lib/ensurePrecache.ts so the page can log
// and assert on the same shape the SW produces. All-zero/empty = healthy.
export interface PrecacheReport {
  // Pathnames from SW_PRECACHE_PATHS that are absent from the pages cache.
  missingPages: string[];
  // Build assets from the serwist manifest absent from the static cache.
  missingStatic: number;
}

export interface TrashResponse {
  retentionDays: number;
  notes: TrashedNote[];
  todos: TrashedTodo[];
}
