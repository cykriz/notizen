import { TrashResponseSchema } from './schemas';
import { removeTombstone } from './localCacheMerge';
import { clearPendingForEntity } from './syncQueue';
import { tryFetch } from './tryFetch';
import type { SyncEntityType } from './types';

/**
 * Ids currently sitting in the server trash, or null when the trash could not be
 * read (offline, error, unparseable). Callers must treat null as "unknown", never
 * as "empty" — see planPush, where guessing wrong duplicates an id.
 *
 * /api/trash bypasses the service worker (SW_BYPASS_API_PREFIXES), so this is
 * never answered from a stale cache.
 */
export async function fetchTrashedIds(): Promise<Set<string> | null> {
  const res = await tryFetch('/api/trash', { method: 'GET' });
  if (res?.ok !== true) {
    return null;
  }

  try {
    const parsed = TrashResponseSchema.parse(await res.json());
    return new Set([...parsed.notes.map((n) => n.id), ...parsed.todos.map((t) => t.id)]);
  } catch {
    return null;
  }
}

/**
 * Restores one trashed entity and clears the local state that would re-hide it.
 * Online-only. Returns false rather than throwing so callers can report a reason.
 */
export async function restoreTrashedEntity(type: SyncEntityType, id: string): Promise<boolean> {
  const res = await tryFetch(`/api/trash/${type}/${id}/restore`, { method: 'POST' });
  if (res?.ok !== true) {
    return false;
  }

  clearPendingForEntity(id);
  removeTombstone(id);
  return true;
}
