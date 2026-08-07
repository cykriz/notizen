import { DEFAULT_NOTE_TITLE, SYNC_ACTION, SYNC_ENTITY } from './constants';
import { readString, readStringArray } from './failedSyncPayload';
import { type SyncQueueEntry, getCachedNote, getCachedNotesList, getCachedTodos } from './localCache';

/**
 * How to make the server match the local state for a failed entry.
 *
 *  'requeue'           — replay the original mutation; it is still the right call.
 *  'recreate'          — the server no longer has the entity, so POST it back with
 *                        the SAME id (create is idempotent on a client id).
 *  'restore-then-push' — the entity sits in the server trash. Restoring first is
 *                        mandatory: createNote's idempotency probe uses getNote,
 *                        which only scans root/notes, so a POST would write a
 *                        SECOND directory carrying this id and the two would
 *                        collide the moment the user restores from the trash.
 *  'blocked'           — cannot be decided safely right now (offline, or the trash
 *                        could not be read so 'recreate' vs 'restore' is unknown).
 */
export type PushStrategy = 'requeue' | 'recreate' | 'restore-then-push' | 'blocked';

/**
 * The only case where the trash has to be read before a strategy can be chosen:
 * an update the server answered 404 to. Exported so the caller deciding whether
 * to fetch the trash uses the SAME predicate as the planner — if the two drift,
 * planPush sees `trashedIds: null` for a case it treats as gone and returns
 * 'blocked', dead-ending the button on "Papierkorb konnte nicht geprüft werden".
 */
export function needsTrashLookup(entry: SyncQueueEntry): boolean {
  return entry.failure?.status === 404 && entry.action === SYNC_ACTION.UPDATE;
}

/**
 * `trashedIds` is null when the trash could not be read (offline or the request
 * failed). That is deliberately NOT treated as "not in the trash": guessing wrong
 * duplicates the id, so an undecidable 404 blocks instead.
 */
export function planPush(
  entry: SyncQueueEntry,
  opts: { isOnline: boolean; trashedIds: ReadonlySet<string> | null },
): PushStrategy {
  if (!opts.isOnline) {
    return 'blocked';
  }

  // A DELETE always converges by replaying: replayMutation maps DELETE 404 to
  // 'ok' because the entity being absent IS the desired end state.
  if (entry.action === SYNC_ACTION.DELETE || !needsTrashLookup(entry)) {
    return 'requeue';
  }

  if (opts.trashedIds === null) {
    return 'blocked';
  }

  return opts.trashedIds.has(entry.entityId) ? 'restore-then-push' : 'recreate';
}

/**
 * The body for re-creating a note server-side, assembled from the failed payload
 * plus the local caches. Returns null when no text can be found at all — pushing
 * an empty note over a title the user still recognises would be worse than
 * telling them nothing is left to push.
 */
export function buildNoteCreatePayload(entry: SyncQueueEntry): Record<string, unknown> | null {
  const cached = getCachedNote(entry.entityId);
  const summary = getCachedNotesList().find((n) => n.id === entry.entityId);
  const title = readString(entry.payload, 'title') ?? cached?.title ?? summary?.title;
  const content = readString(entry.payload, 'content') ?? cached?.content;
  if (content === undefined) {
    return null;
  }

  return {
    id: entry.entityId,
    // CreateNoteSchema requires a non-empty title.
    title: title !== undefined && title !== '' ? title : DEFAULT_NOTE_TITLE,
    content,
    tags: readStringArray(entry.payload, 'tags') ?? cached?.tags ?? summary?.tags ?? [],
  };
}

/** Same for a todo: the cached row is the whole entity, so it is the source. */
export function buildTodoCreatePayload(entry: SyncQueueEntry): Record<string, unknown> | null {
  const todo = getCachedTodos().find((t) => t.id === entry.entityId);
  if (todo === undefined) {
    return null;
  }

  return {
    id: todo.id,
    title: todo.title,
    quadrant: todo.quadrant,
    // CreateTodoSchema has no .nullable(), so absent optionals must be omitted
    // rather than sent as null.
    ...(todo.description !== undefined ? { description: todo.description } : {}),
    ...(todo.dueDate !== undefined ? { dueDate: todo.dueDate } : {}),
    ...(todo.linkedNoteIds !== undefined ? { linkedNoteIds: todo.linkedNoteIds } : {}),
  };
}

export function buildCreatePayload(entry: SyncQueueEntry): Record<string, unknown> | null {
  return entry.entityType === SYNC_ENTITY.NOTE ? buildNoteCreatePayload(entry) : buildTodoCreatePayload(entry);
}
