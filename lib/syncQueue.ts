import {
  type SyncQueueEntry,
  getSyncQueue,
  setSyncQueue,
} from "@/lib/localCache";
import { addToFailedSync } from "@/lib/failedSyncQueue";
import { SYNC_ACTION, SYNC_ENTITY, SYNC_MAX_RETRIES } from "@/lib/constants";

let processing = false;

export function enqueueMutation(entry: SyncQueueEntry): void {
  const queue = getSyncQueue();

  // Dedup: only replaces entries with the SAME action (e.g. update+update).
  // Different actions for the same entity (create, update, delete) intentionally
  // coexist — the FIFO queue replays them in order so create→update→delete works.
  const existingIdx = queue.findIndex(
    (e) =>
      e.entityType === entry.entityType &&
      e.entityId === entry.entityId &&
      e.action === entry.action,
  );

  if (existingIdx >= 0) {
    queue[existingIdx] = entry;
  } else {
    queue.push(entry);
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

export async function processSyncQueue(): Promise<void> {
  if (processing) {
    return;
  }

  processing = true;

  try {
    let queue = getSyncQueue();
    while (queue.length > 0) {
      const entry = queue[0];

      if ((entry.retryCount ?? 0) >= SYNC_MAX_RETRIES) {
        console.error('Sync entry exceeded max retries, moving to failed:', entry);
        addToFailedSync(entry);
        queue.shift();
        setSyncQueue(queue);
        continue;
      }

      try {
        const result = await replayMutation(entry);

        if (result === 'discard') {
          console.error('Sync entry not retryable, moving to failed:', entry);
          addToFailedSync(entry);
          queue.shift();
          setSyncQueue(queue);
        } else if (result === 'retry') {
          entry.retryCount = (entry.retryCount ?? 0) + 1;
          queue[0] = entry;
          setSyncQueue(queue);
          break;
        } else {
          queue = queue.filter(
            (e) => !(e.entityType === entry.entityType && e.entityId === entry.entityId && e.action === entry.action),
          );
          setSyncQueue(queue);
        }
      } catch {
        entry.retryCount = (entry.retryCount ?? 0) + 1;
        queue[0] = entry;
        setSyncQueue(queue);
        break;
      }
    }
  } finally {
    processing = false;
  }
}

async function replayMutation(entry: SyncQueueEntry): Promise<'ok' | 'discard' | 'retry'> {
  const { entityType, entityId, action, payload } = entry;
  const baseUrl = entityType === SYNC_ENTITY.NOTE ? "/api/notes" : "/api/todos";

  let url: string;
  let method: string;
  let body: string | undefined;

  switch (action) {
    case SYNC_ACTION.CREATE: {
      url = baseUrl;
      method = "POST";
      body = JSON.stringify(payload);
      break;
    }

    case SYNC_ACTION.UPDATE: {
      url = `${baseUrl}/${entityId}`;
      method = "PUT";
      body = JSON.stringify(payload);
      break;
    }

    case SYNC_ACTION.DELETE: {
      url = `${baseUrl}/${entityId}`;
      method = "DELETE";
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
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Sync replay ${action} ${entityType}/${entityId}: ${res.status.toString()}`, text);

    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }

      throw new Error("Session expired");
    }

    if (res.status >= 500 || !navigator.onLine) {
      return 'retry';
    }

    return 'discard';
  }

  return 'ok';
}
