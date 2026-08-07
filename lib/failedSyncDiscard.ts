import {
  type SyncQueueEntry,
  clearDraft,
  getCachedNotesList,
  getCachedTodos,
  getSyncQueue,
  removeCachedNote,
  setCachedNotesList,
  setCachedTodos,
  setSyncQueue,
} from './localCache';
import {
  clearFailedSyncQueue,
  getInspectableEntries,
  removeFromFailedSync,
} from './failedSyncQueue';
import { SYNC_ENTITY } from './constants';
import { removeTombstone } from './localCacheMerge';

/**
 * Removes the local state a discarded mutation would otherwise resurrect.
 *
 * Dropping the queue entry alone is not enough. Two separate leaks:
 *  (a) notizen:note:<id> / notizen:draft:<id> survive, and useNoteInitialState
 *      prefers them when newer — the discarded text stays reachable by URL and
 *      auto-save pushes it straight back to the server.
 *  (b) update*Offline writes title/tags/pinned (notes) and the whole mutated
 *      todo into the cached LIST with a fresh updatedAt. mergeById prefers the
 *      newer local row permanently and useDataSync re-persists that merge, so a
 *      discarded title would otherwise sit in the sidebar forever.
 *
 * Never adds a tombstone: that would hide a row the server legitimately has.
 */
function purgeLocalState(entry: SyncQueueEntry): void {
  const { entityType, entityId } = entry;

  if (entityType === SYNC_ENTITY.NOTE) {
    setCachedNotesList(getCachedNotesList().filter((n) => n.id !== entityId));
    // UNCONDITIONAL. This used to be gated on the payload carrying title/content,
    // to preserve the offline copy of a note whose failed change was metadata-only.
    // That nuance is not worth the failure mode: whenever the guard reads false the
    // offline text survives with a newer updatedAt than the server's, so
    // useNoteInitialState prefers it, the editor shows it, and auto-save uploads it.
    // The cost of purging always is that the note re-fetches on next open.
    removeCachedNote(entityId);
    clearDraft(entityId);
  } else {
    setCachedTodos(getCachedTodos().filter((t) => t.id !== entityId));
  }
}

/**
 * Discards one inspectable entry: "make LOCAL match the server".
 *
 * That means every trace of un-synced local intent for this entity has to go —
 * the failure record, ALL queued mutations for it, the tombstone, and the caches.
 * Anything left behind still reaches the server on the next drain, because a queue
 * entry carries its own payload; purging the caches cannot stop it. Leaving a
 * newer queued edit in place (as this used to) uploaded the very change the user
 * had just discarded.
 *
 * A queued mutation is by definition something the server has NOT seen, so
 * dropping it is exactly as legitimate as dropping the cached text — including a
 * queued delete, whose intent also never left this device. refreshFromServer then
 * repopulates whatever the server actually holds.
 */
export function discardEntry(entry: SyncQueueEntry): void {
  removeFromFailedSync(entry.entityType, entry.entityId);
  setSyncQueue(getSyncQueue().filter((e) => e.entityId !== entry.entityId));
  // Un-synced delete intent. Harmless when the delete DID reach the server: the
  // server simply stops returning the row, so nothing resurrects.
  removeTombstone(entry.entityId);
  purgeLocalState(entry);
}

export function discardAllEntries(): void {
  for (const entry of getInspectableEntries()) {
    discardEntry(entry);
  }

  // Normally a no-op: discardEntry already removed each one. Kept as a backstop
  // because removeFromFailedSync swallows a failed localStorage write, and this
  // single removeItem is the only thing that would still clear the queue then.
  clearFailedSyncQueue();
}
