import type { SyncQueueEntry } from '@/lib/localCache';
import type { SyncEntityType } from '@/lib/types';
import { SYNC_ACTION } from '@/lib/constants';
import { ackFailedSync, addToFailedSync, markFailure } from '@/lib/failedSyncQueue';
import { addTombstone } from '@/lib/localCacheMerge';
import { ConflictResponseSchema } from '@/lib/schemas';
import { clearPendingForEntity, enqueueMutation, hasPendingCreate, hasPendingForEntity } from '@/lib/syncQueue';
import { classifyErrorResponse } from '@/lib/syncReplay';
import { tryFetch } from '@/lib/tryFetch';

/** A mutation as it would be queued. The transport fields are owned by the queue. */
export type PendingMutation = Omit<SyncQueueEntry, 'retryCount' | 'seq' | 'failure'>;

export interface OfflineWriteRequest {
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  /** JSON body; omit for DELETE. */
  body?: unknown;
  /**
   * Sends X-Expected-UpdatedAt AND enables the one-shot re-send with the
   * server's own version on 409. Never set the header without that retry: that
   * combination is exactly what silently dropped every todo update after the
   * first one.
   */
  expectedUpdatedAt?: string;
}

/**
 * Four names, one caller-visible distinction: only `ok` carries a body worth
 * adopting, and every call site tests exactly that. The other three are kept
 * apart deliberately — they name where the mutation ended up, which is the
 * decision table this module exists to own, and collapsing them would make the
 * outcomes unreadable at the point they are decided.
 */
export type OfflineWriteResult =
  | { outcome: 'ok'; body: unknown }  // 2xx, body already read (null if unparseable)
  | { outcome: 'benign' }             // non-2xx that already is the desired end state
  | { outcome: 'queued' }             // offline / 5xx / network error — retry is worthwhile
  | { outcome: 'rejected' };          // deterministic 4xx — straight to the inspector

interface DeleteEntityOptions<T> {
  entityType: SyncEntityType;
  /** Collection route, e.g. '/api/todos'. */
  baseUrl: string;
  writeCache: (rows: T[]) => void;
}

/**
 * Optimistic delete: hide locally, tombstone, then send or queue.
 *
 * Shared because the note and todo versions were identical apart from the entity
 * type, the cache setter and the URL. A DELETE that 404s counts as done —
 * classifyErrorResponse folds that in, so it needs no special casing here.
 */
export async function deleteEntityOffline<T extends { id: string }>(
  id: string,
  current: T[],
  isOnline: boolean,
  { entityType, baseUrl, writeCache }: DeleteEntityOptions<T>,
): Promise<T[]> {
  const now = new Date().toISOString();
  const updatedList = current.filter((row) => row.id !== id);
  writeCache(updatedList);
  addTombstone(id);

  // Created offline and never synced: drop the queued create instead of asking
  // the server to delete something it never received.
  if (hasPendingCreate(id)) {
    clearPendingForEntity(id);
    return updatedList;
  }

  await sendOrQueue(
    { entityType, entityId: id, action: SYNC_ACTION.DELETE, payload: {}, timestamp: now },
    { url: `${baseUrl}/${id}`, method: 'DELETE' },
    isOnline,
  );

  return updatedList;
}

/**
 * Reads a response body without ever rejecting. An empty or non-JSON body would
 * otherwise throw *after* the write already succeeded, leaving the caller's
 * promise rejected and React state un-updated while the cache holds the
 * optimistic row.
 */
export async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Sends one mutation, or queues it for replay — the single place that decides
 * what a failed write means.
 *
 * Notes and todos had drifted apart here: notes adopted the server response,
 * retried a 409 and enqueued on a rejection, while todos did none of the three,
 * so every todo edit after the first silently disappeared. Both now share this.
 */
export async function sendOrQueue(
  entry: PendingMutation,
  request: OfflineWriteRequest,
  isOnline: boolean,
): Promise<OfflineWriteResult> {
  // Queue-first while offline, or when this entity already has queued work —
  // writing directly past a pending mutation would reorder the two.
  if (!isOnline || hasPendingForEntity(entry.entityId)) {
    enqueueMutation(entry);
    return { outcome: 'queued' };
  }

  // Built per attempt rather than mutated in place: the re-send below has to
  // carry the server's version, and a shared headers object would make that
  // depend on aliasing — one defensive `{ ...headers }` by a later editor would
  // silently re-send the stale version and turn every 409 into a discard.
  const send = (expected?: string) => tryFetch(request.url, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      ...(expected !== undefined ? { 'X-Expected-UpdatedAt': expected } : {}),
    },
    ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
  });

  let res = await send(request.expectedUpdatedAt);

  // 409 means our expected-version header was stale. Re-send once with the
  // version the server itself reports.
  if (res !== null && res.status === 409 && request.expectedUpdatedAt !== undefined) {
    const parsed = ConflictResponseSchema.safeParse(await readJson(res));
    if (parsed.success) {
      res = await send(parsed.data.serverVersion.updatedAt);
    }
  }

  // null = network error, or a 401 that tryFetch turned into a login redirect.
  // Either way the change has to survive.
  if (res === null) {
    enqueueMutation(entry);
    return { outcome: 'queued' };
  }

  if (res.ok) {
    ackFailedSync(entry);
    return { outcome: 'ok', body: await readJson(res) };
  }

  // Shared with the queue replay, so the same answer never means "retry" on one
  // path and "give up" on the other. It also folds in DELETE + 404 = success.
  const result = await classifyErrorResponse(res, entry.action);
  if (result.outcome === 'ok') {
    ackFailedSync(entry);
    return { outcome: 'benign' };
  }

  console.error(`${request.method} ${request.url}: ${res.status.toString()}`, result.message ?? '');

  if (result.outcome === 'retry') {
    enqueueMutation(entry);
    return { outcome: 'queued' };
  }

  // Deterministic 4xx: retrying cannot help, and burning five backoff cycles
  // would block the shared FIFO for every other entity. Straight to the
  // inspector instead. If even that write fails (quota), fall back to the
  // queue — the mutation must never be dropped on the floor.
  if (!addToFailedSync(markFailure(entry, 'non-retryable', result))) {
    enqueueMutation(entry);
    return { outcome: 'queued' };
  }

  return { outcome: 'rejected' };
}
