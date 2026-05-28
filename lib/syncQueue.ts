import { type SyncQueueEntry, getSyncQueue, nextSyncSeq, setSyncQueue } from '@/lib/localCache';
import { addToFailedSync, removeFromFailedSync } from '@/lib/failedSyncQueue';
import { SYNC_ACTION, SYNC_ENTITY, SYNC_MAX_RETRIES } from '@/lib/constants';

let processing = false;

export function enqueueMutation(entry: SyncQueueEntry): void {
  const queue = getSyncQueue();
  const seq = nextSyncSeq();

  // Dedup: only replaces entries with the SAME action (e.g. update+update).
  // Different actions for the same entity (create, update, delete) intentionally
  // coexist — the FIFO queue replays them in order so create→update→delete works.
  const existingIdx = queue.findIndex(
    (e) => e.entityType === entry.entityType && e.entityId === entry.entityId && e.action === entry.action,
  );

  if (existingIdx >= 0) {
    queue[existingIdx] = { ...entry, seq };
  } else {
    queue.push({ ...entry, seq });
  }

  setSyncQueue(queue);
}

export function hasPendingForEntity(entityId: string): boolean {
  return getSyncQueue().some((e) => e.entityId === entityId);
}

export function hasPendingCreate(entityId: string): boolean {
  return getSyncQueue().some((e) => e.entityId === entityId && e.action === SYNC_ACTION.CREATE);
}

export function clearPendingForEntity(entityId: string): void {
  const queue = getSyncQueue().filter((e) => e.entityId !== entityId);
  setSyncQueue(queue);
}

export function getPendingCount(): number {
  return getSyncQueue().length;
}

function headMatches(head: SyncQueueEntry, current: SyncQueueEntry): boolean {
  if (current.seq !== undefined && head.seq !== undefined) {
    return head.seq === current.seq;
  }

  return head.entityType === current.entityType && head.entityId === current.entityId && head.action === current.action;
}

function removeHeadIfMatches(current: SyncQueueEntry): void {
  const fresh = getSyncQueue();
  if (fresh.length > 0 && headMatches(fresh[0], current)) {
    fresh.shift();
    setSyncQueue(fresh);
  }
}

function updateHeadRetryIfMatches(current: SyncQueueEntry): void {
  const fresh = getSyncQueue();
  if (fresh.length > 0 && headMatches(fresh[0], current)) {
    fresh[0] = { ...fresh[0], retryCount: (fresh[0].retryCount ?? 0) + 1 };
    setSyncQueue(fresh);
  }
}

export async function processSyncQueue(): Promise<void> {
  if (processing) {
    return;
  }

  processing = true;

  try {
    // Re-read from localStorage on every iteration so entries enqueued
    // concurrently (e.g. user action during an in-flight replay) are never
    // silently overwritten.
    let queue = getSyncQueue();

    while (queue.length > 0) {
      const entry = queue[0];

      if ((entry.retryCount ?? 0) >= SYNC_MAX_RETRIES) {
        console.error('Sync entry exceeded max retries, moving to failed:', entry);
        addToFailedSync(entry);
        removeHeadIfMatches(entry);
        queue = getSyncQueue();
        continue;
      }

      try {
        const result = await replayMutation(entry);

        if (result === 'discard') {
          console.error('Sync entry not retryable, moving to failed:', entry);
          addToFailedSync(entry);
          removeHeadIfMatches(entry);
          queue = getSyncQueue();
        } else if (result === 'retry') {
          updateHeadRetryIfMatches(entry);
          queue = getSyncQueue();
          break;
        } else {
          // Any later successful op for this id means the client has moved on,
          // so drop any earlier failure marker for the same entity. Concrete
          // cases this covers: successful DELETE clears a failed CREATE/UPDATE;
          // a fresh UPDATE that finally succeeds clears its own prior failure.
          // We deliberately match by id, not action.
          removeFromFailedSync(entry.entityType, entry.entityId);
          removeHeadIfMatches(entry);
          queue = getSyncQueue();
        }
      } catch {
        updateHeadRetryIfMatches(entry);
        queue = getSyncQueue();
        break;
      }
    }
  } finally {
    processing = false;
  }
}

async function replayMutation(entry: SyncQueueEntry): Promise<'ok' | 'discard' | 'retry'> {
  const { entityType, entityId, action, payload } = entry;
  const baseUrl = entityType === SYNC_ENTITY.NOTE ? '/api/notes' : '/api/todos';

  let url: string;
  let method: string;
  let body: string | undefined;

  switch (action) {
    case SYNC_ACTION.CREATE: {
      url = baseUrl;
      method = 'POST';
      body = JSON.stringify(payload);
      break;
    }

    case SYNC_ACTION.UPDATE: {
      url = `${baseUrl}/${entityId}`;
      method = 'PUT';
      body = JSON.stringify(payload);
      break;
    }

    case SYNC_ACTION.DELETE: {
      url = `${baseUrl}/${entityId}`;
      method = 'DELETE';
      break;
    }

    default: {
      throw new Error(`Unknown sync action: ${action as string}`);
    }
  }

  // No X-Expected-UpdatedAt header: queue-replayed mutations skip conflict
  // detection since they are sequential writes from the same user.
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`Sync replay ${action} ${entityType}/${entityId}: ${res.status.toString()}`, text);

    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }

      throw new Error('Session expired');
    }

    // Treat DELETE 404 as success — the entity is already gone server-side,
    // which is the desired end state. Prevents the row from appearing as a
    // ghost with a sync-fehler tag. UPDATE/CREATE 404 intentionally stay as
    // discards: an UPDATE 404 means the user's edits were lost and the
    // sync-fehler marker is the truth they need to see.
    if (action === SYNC_ACTION.DELETE && res.status === 404) {
      return 'ok';
    }

    if (res.status >= 500 || !navigator.onLine) {
      return 'retry';
    }

    return 'discard';
  }

  return 'ok';
}
