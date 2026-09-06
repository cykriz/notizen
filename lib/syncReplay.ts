import type { SyncQueueEntry } from '@/lib/localCache';
import type { SyncAction } from '@/lib/types';
import { SYNC_ACTION, SYNC_ENTITY, SYNC_ERROR_BODY_MAX } from '@/lib/constants';
import { LOGIN_PATH } from '@/lib/pathConstants';

export type ReplayOutcome = 'ok' | 'discard' | 'retry' | 'offline';

export interface ReplayResult {
  outcome: ReplayOutcome;
  // Present only when the server actually answered with a non-ok status.
  status?: number;
  // Response body, trimmed to SYNC_ERROR_BODY_MAX.
  message?: string;
}

/**
 * The single place that decides what a non-ok response means.
 *
 * The direct write path (sendOrQueue) and the queue replay must agree, or the
 * same server answer would be retried in one and discarded in the other. Reads
 * the body, so call it at most once per response.
 */
export async function classifyErrorResponse(
  res: Response,
  action: SyncAction,
): Promise<ReplayResult> {
  const message = (await res.text().catch(() => '')).slice(0, SYNC_ERROR_BODY_MAX);

  // DELETE + 404 = the entity is already gone server-side, which is the desired
  // end state. Prevents a ghost row carrying a sync-fehler tag. UPDATE/CREATE
  // 404 intentionally stays a discard: an UPDATE 404 means the user's edits were
  // lost and the marker is the truth they need to see.
  if (action === SYNC_ACTION.DELETE && res.status === 404) {
    return { outcome: 'ok' };
  }

  if (res.status >= 500 || !navigator.onLine) {
    return { outcome: 'retry', status: res.status, message };
  }

  return { outcome: 'discard', status: res.status, message };
}

/**
 * Replays one queued mutation against the API.
 *
 * Extracted from syncQueue.ts (which was over the 200-line limit). Behaviour is
 * unchanged; the status and response body — previously only console.error'd —
 * now ride along in ReplayResult so the caller can persist them onto the entry.
 */
export async function replayMutation(entry: SyncQueueEntry): Promise<ReplayResult> {
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
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch {
    // fetch throws only on network errors (offline). Signal 'offline' so the
    // caller pauses without counting this against SYNC_MAX_RETRIES — otherwise
    // a long-enough offline period would wrongly tag the note 'sync-fehler'.
    return { outcome: 'offline' };
  }

  if (!res.ok) {
    // 401 is handled here rather than in classifyErrorResponse: the replay loop
    // needs it to THROW so the drain stops, which tryFetch's silent redirect
    // cannot express.
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = LOGIN_PATH;
      }

      throw new Error('Session expired');
    }

    const result = await classifyErrorResponse(res, action);
    console.error(
      `Sync replay ${action} ${entityType}/${entityId}: ${res.status.toString()}`,
      result.message ?? '',
    );
    return result;
  }

  return { outcome: 'ok' };
}
