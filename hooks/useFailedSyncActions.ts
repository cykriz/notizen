import { useCallback } from 'react';
import { SYNC_ACTION } from '@/lib/constants';
import { getInspectableCount, getInspectableEntries } from '@/lib/failedSyncQueue';
import { discardAllEntries, discardEntry } from '@/lib/failedSyncDiscard';
import { buildCreatePayload, needsTrashLookup, planPush } from '@/lib/failedSyncPush';
import { enqueueMutation, hasPendingForEntity, requeueFailedEntry } from '@/lib/syncQueue';
import { fetchTrashedIds, restoreTrashedEntity } from '@/lib/trashRecovery';
import type { SyncEntityType } from '@/lib/types';

/**
 * Outcome of "upload local to the server", so the caller can say what happened
 * instead of claiming a generic success.
 */
export type PushResult =
  | 'queued' // the original mutation is on its way again
  | 'recreated' // gone server-side, queued as a fresh create with the same id
  | 'restored' // pulled back out of the server trash, then queued
  | 'offline'
  | 'undecidable' // online, but the trash could not be read — see planPush
  | 'nothing-to-push' // no local text left to upload
  | 'skipped' // already resolved, or a newer change is queued
  | 'error';

interface UseFailedSyncActionsArgs {
  isOnlineRef: React.RefObject<boolean>;
  setFailedSyncCount: React.Dispatch<React.SetStateAction<number>>;
  setFailedSyncVersion: React.Dispatch<React.SetStateAction<number>>;
  refreshFromServer: () => Promise<void>;
  syncPending: () => void;
}

export interface FailedSyncActions {
  // Makes the SERVER match local. Async because a 404 has to check the trash
  // before it can decide between re-creating and restoring.
  pushFailedSync: (entityType: SyncEntityType, entityId: string) => Promise<PushResult>;
  // Makes LOCAL match the server: drops the unsynced change and its cached
  // remnants, then re-pulls server truth.
  discardFailedSync: (entityType: SyncEntityType, entityId: string) => void;
  discardAllFailedSync: () => void;
}

/**
 * The two directions the inspector can resolve a failed entry in. Both end with
 * local and server agreeing — that is the whole point of offering exactly these
 * two, rather than a retry that can dead-end on a 404.
 *
 * Split out of useDataSync purely for the 200-line limit; it owns no state and
 * drives the caller's setters so failedSyncVersion keeps working as the reactive
 * proxy for queue *contents*.
 */
export function useFailedSyncActions({
  isOnlineRef,
  setFailedSyncCount,
  setFailedSyncVersion,
  refreshFromServer,
  syncPending,
}: UseFailedSyncActionsArgs): FailedSyncActions {
  const sync = useCallback(() => {
    setFailedSyncCount(getInspectableCount());
    setFailedSyncVersion((v) => v + 1);
  }, [setFailedSyncCount, setFailedSyncVersion]);

  const find = (entityType: SyncEntityType, entityId: string) =>
    getInspectableEntries().find((e) => e.entityType === entityType && e.entityId === entityId);

  const pushFailedSync = useCallback(
    async (entityType: SyncEntityType, entityId: string): Promise<PushResult> => {
      const entry = find(entityType, entityId);
      if (entry === undefined) {
        return 'skipped';
      }

      // A newer mutation already waiting would be overwritten by the requeue
      // (enqueueMutation dedups on the same action) or replayed out of order. A
      // 'not-recorded' entry is exempt: it IS the pending entry, parked with a
      // spent retry budget, and the requeue is what unparks it.
      const isStuck = entry.failure?.reason === 'not-recorded';
      if (!isStuck && hasPendingForEntity(entityId)) {
        return 'skipped';
      }

      // Only a 404'd update needs the trash lookup; everything else decides
      // offline. Shares planPush's predicate so the two cannot disagree.
      const trashedIds = needsTrashLookup(entry) && isOnlineRef.current ? await fetchTrashedIds() : null;
      const strategy = planPush(entry, { isOnline: isOnlineRef.current, trashedIds });

      if (strategy === 'blocked') {
        return isOnlineRef.current ? 'undecidable' : 'offline';
      }

      if (strategy === 'restore-then-push' && !(await restoreTrashedEntity(entityType, entityId))) {
        return 'error';
      }

      if (strategy === 'recreate') {
        const payload = buildCreatePayload(entry);
        if (payload === null) {
          return 'nothing-to-push';
        }

        // A create, not the original update: the server has nothing to update.
        // The failed entry deliberately stays until this succeeds — processSyncQueue
        // clears it by id on any successful op, so there is no window without a record.
        enqueueMutation({
          entityType,
          entityId,
          action: SYNC_ACTION.CREATE,
          payload,
          timestamp: new Date().toISOString(),
        });
      } else {
        requeueFailedEntry(entry);
      }

      sync();
      syncPending();
      if (strategy === 'recreate') {
        return 'recreated';
      }

      return strategy === 'restore-then-push' ? 'restored' : 'queued';
    },
    [isOnlineRef, sync, syncPending],
  );

  const discardFailedSync = useCallback(
    (entityType: SyncEntityType, entityId: string) => {
      const entry = find(entityType, entityId);
      if (entry === undefined) {
        return;
      }

      discardEntry(entry);
      sync();
      // Rows kept alive only by this entry (see mergeById) are now orphans;
      // refreshing restores server truth. Offline this is a no-op, so the row
      // simply stays gone until the next reconnect — the same semantics the
      // previous global clear already had.
      void refreshFromServer();
    },
    [refreshFromServer, sync],
  );

  const discardAllFailedSync = useCallback(() => {
    discardAllEntries();
    sync();
    void refreshFromServer();
  }, [refreshFromServer, sync]);

  return { pushFailedSync, discardFailedSync, discardAllFailedSync };
}
