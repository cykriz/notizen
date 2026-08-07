import { DEFAULT_NOTE_TITLE, FAILED_SYNC_TAG, SYNC_ACTION, SYNC_ENTITY } from './constants';
import { FAILED_SYNC_TODOS_FILE } from './failedSyncConstants';
import { type FailedSyncCause, describeFailureCause } from './failedSyncCause';
import { readFailure, readString, readStringArray, todoFields } from './failedSyncPayload';
import { NOTE_PREFIX, TODOS_KEY, type SyncQueueEntry } from './localCache';
import type { Note, NoteSummary, SyncAction, SyncEntityType, Todo } from './types';

// Everything the view model needs is INJECTED — this module never touches
// localStorage, which is what lets it be unit-tested under `bun test` with no
// DOM shim.
export interface FailedSyncSources {
  notes: NoteSummary[];
  todos: Todo[];
  getCachedNote: (id: string) => Note | null;
  // Entity ids with a mutation waiting in notizen:sync-queue. Retry must be
  // blocked for these: re-queuing would overwrite the newer payload or replay
  // out of order.
  pendingIds: ReadonlySet<string>;
  // Entity ids whose CREATE never reached the server (an open create in either
  // queue) — the only reliable "nothing exists server-side yet" signal for todos.
  unsyncedCreateIds: ReadonlySet<string>;
}

export type FailedSyncContentSource = 'payload' | 'cache' | 'metadata-only' | 'missing';

export interface FailedSyncDetail {
  // `${entityType}:${entityId}` — unique by construction (the failed queue
  // dedups on exactly that pair).
  key: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  title: string;
  // The note text this mutation would have written, verbatim markdown.
  content: string | null;
  // Where `content` came from, and — when there is none — whether that is
  // harmless. 'metadata-only' means the mutation never touched the body, so
  // nothing is at risk; 'missing' means text that WAS part of the change can no
  // longer be found locally. The UI must not conflate the two.
  contentSource: FailedSyncContentSource;
  // Slash-separated tag paths ("folders"), FAILED_SYNC_TAG stripped.
  folders: string[];
  // Path under the user's data root, or null when the server never had it.
  serverPath: string | null;
  // Where the unsynced copy actually sits in localStorage.
  localKey: string;
  pushBlocked: boolean;
  changedAt: string;
  failedAt: string | null;
  attempts: number | null;
  cause: FailedSyncCause;
  // Todo extras; empty for notes.
  fields: { label: string; value: string }[];
}

function resolveContent(
  entry: SyncQueueEntry,
  sources: FailedSyncSources,
): { content: string | null; source: FailedSyncContentSource } {
  // Update payloads are partial — a pin- or tag-only change carries no content.
  const fromPayload = readString(entry.payload, 'content');
  if (fromPayload !== undefined) {
    return { content: fromPayload, source: 'payload' };
  }

  if (entry.entityType === SYNC_ENTITY.NOTE) {
    const cached = sources.getCachedNote(entry.entityId);
    if (cached !== null) {
      return { content: cached.content, source: 'cache' };
    }
  } else {
    const description = sources.todos.find((t) => t.id === entry.entityId)?.description;
    if (description !== undefined && description !== '') {
      return { content: description, source: 'cache' };
    }
  }

  // Nothing found. An UPDATE without a `content` key never carried the body, so
  // there is nothing to lose; a CREATE always carries one (see offlineNotes),
  // hence a create landing here means the text really is unrecoverable.
  return { content: null, source: entry.action === SYNC_ACTION.UPDATE ? 'metadata-only' : 'missing' };
}

function resolveServerPath(
  entry: SyncQueueEntry,
  summary: NoteSummary | undefined,
  sources: FailedSyncSources,
): string | null {
  if (sources.unsyncedCreateIds.has(entry.entityId)) {
    return null;
  }

  if (entry.entityType === SYNC_ENTITY.TODO) {
    return FAILED_SYNC_TODOS_FILE;
  }

  // The slug is server-assigned and stays '' for notes created offline, so an
  // empty slug means the server has never seen this note.
  const slug = summary?.slug ?? sources.getCachedNote(entry.entityId)?.slug ?? '';
  return slug === '' ? null : `notes/${slug}/note.md`;
}

function resolveTitle(entry: SyncQueueEntry, summary: NoteSummary | undefined, todo: Todo | undefined): string {
  return (
    readString(entry.payload, 'title') ??
    summary?.title ??
    todo?.title ??
    DEFAULT_NOTE_TITLE
  );
}

function toDetail(entry: SyncQueueEntry, sources: FailedSyncSources): FailedSyncDetail {
  const isNote = entry.entityType === SYNC_ENTITY.NOTE;
  const summary = isNote ? sources.notes.find((n) => n.id === entry.entityId) : undefined;
  const todo = isNote ? undefined : sources.todos.find((t) => t.id === entry.entityId);
  const cachedNote = isNote ? sources.getCachedNote(entry.entityId) : null;

  const { content, source } = resolveContent(entry, sources);
  const serverPath = resolveServerPath(entry, summary, sources);
  const failure = readFailure(entry.failure);
  // A 'not-recorded' entry IS the pending entry — parked with a spent retry
  // budget, so nothing will ever replay it by itself. Blocking retry on it would
  // leave the only recovery path disabled behind a "transfer running" tooltip
  // while nothing runs. Every other pending id must stay blocked.
  const isStuck = failure?.reason === 'not-recorded';

  // FAILED_SYNC_TAG is injected at render time only (see failedSyncTag.ts) and
  // must never be presented as a real folder.
  const tags = readStringArray(entry.payload, 'tags') ?? summary?.tags ?? cachedNote?.tags ?? [];

  return {
    key: `${entry.entityType}:${entry.entityId}`,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    title: resolveTitle(entry, summary, todo),
    content,
    contentSource: source,
    folders: tags.filter((t) => t !== FAILED_SYNC_TAG),
    serverPath,
    localKey: isNote ? `${NOTE_PREFIX}${entry.entityId}` : TODOS_KEY,
    pushBlocked: !isStuck && sources.pendingIds.has(entry.entityId),
    changedAt: entry.timestamp,
    failedAt: failure?.failedAt !== undefined && failure.failedAt !== '' ? failure.failedAt : null,
    attempts: failure?.attempts !== undefined && failure.attempts > 0 ? failure.attempts : null,
    cause: describeFailureCause(failure, entry.entityType),
    fields: isNote ? [] : todoFields(entry.payload, todo),
  };
}

/** Newest failure first, falling back to the mutation time for legacy entries. */
export function toFailedSyncDetails(
  entries: SyncQueueEntry[],
  sources: FailedSyncSources,
): FailedSyncDetail[] {
  return entries
    .map((entry) => toDetail(entry, sources))
    .sort((a, b) => new Date(b.failedAt ?? b.changedAt).getTime() - new Date(a.failedAt ?? a.changedAt).getTime());
}

/** The escape hatch that makes discarding defensible: the content as plain text. */
export function buildClipboardText(detail: FailedSyncDetail): string {
  const parts = [detail.title];
  if (detail.folders.length > 0) {
    parts.push(detail.folders.join(', '));
  }

  for (const field of detail.fields) {
    parts.push(`${field.label}: ${field.value}`);
  }

  if (detail.content !== null) {
    parts.push('', detail.content);
  }

  return parts.join('\n');
}
