import {
  type SyncQueueEntry,
  getSyncQueue,
  setSyncQueue,
} from "@/lib/localCache";
import { SYNC_ACTION, SYNC_ENTITY } from "@/lib/constants";

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
      try {
        await replayMutation(entry);
        queue = getSyncQueue();
        queue = queue.filter(
          (e) => !(e.entityType === entry.entityType && e.entityId === entry.entityId && e.action === entry.action),
        );
        setSyncQueue(queue);
      } catch (err) {
        console.error("Sync queue entry failed, stopping:", entry, err);
        break;
      }
    }
  } finally {
    processing = false;
  }
}

async function replayMutation(entry: SyncQueueEntry): Promise<void> {
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
    const body = await res.text().catch(() => "");
    console.error(`Sync replay ${action} ${entityType}/${entityId}: ${res.status.toString()}`, body);
    if (res.status >= 500 || !navigator.onLine) {
      throw new Error(`Sync failed: ${res.status.toString()}`);
    }

    // 4xx (except 409) = discard (bad data, retrying won't help)
  }
}
