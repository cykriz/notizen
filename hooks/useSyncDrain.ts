import { useCallback, useRef } from 'react';
import { getInspectableCount } from '@/lib/failedSyncQueue';
import { getPendingCount, processSyncQueue } from '@/lib/syncQueue';
import { SYNC_RETRY_INTERVAL_MS } from '@/lib/constants';

interface UseSyncDrainArgs {
  isOnlineRef: React.RefObject<boolean>;
  /** Backoff interval owned by useDataSync's retry effect; reset on a manual sync. */
  delayRef: React.RefObject<number>;
  setHasPendingSync: React.Dispatch<React.SetStateAction<boolean>>;
  setFailedSyncCount: React.Dispatch<React.SetStateAction<number>>;
  setFailedSyncVersion: React.Dispatch<React.SetStateAction<number>>;
  refreshFromServer: () => Promise<void>;
}

/**
 * The one place the outbox is drained. Split out of useDataSync to keep it under
 * the 200-line cap — same precedent as useFailedSyncActions — and used by both
 * the manual button and the backoff retry effect, so the two cannot drift.
 */
export function useSyncDrain({
  isOnlineRef,
  delayRef,
  setHasPendingSync,
  setFailedSyncCount,
  setFailedSyncVersion,
  refreshFromServer,
}: UseSyncDrainArgs) {
  // Lets a quiet failed queue skip the version bump below.
  const lastInspectableRef = useRef(0);

  /**
   * Pushes the outbox and reports what is left.
   *
   * Owns the ordering rule structurally rather than by comment: setHasPendingSync
   * is the first statement, so no caller can defer it behind an await, and the
   * remaining count is the return value, so no caller can read a stale one. That
   * first call is what arms the backoff effect in useDataSync, which every
   * mutation callback in DataProvider and useFailedSyncActions depends on.
   */
  const push = useCallback(async (resetBackoff: boolean): Promise<number> => {
    const count = getPendingCount();
    setHasPendingSync(count > 0);
    if (!isOnlineRef.current || count === 0) {
      return count;
    }

    if (resetBackoff) {
      // Otherwise the automatic retry keeps waiting out an interval already grown
      // to as much as five minutes. Manual path only: doing it after every
      // mutation would let a debounced autosave hammer a server that is down.
      delayRef.current = SYNC_RETRY_INTERVAL_MS;
    }

    try {
      // A click during an in-flight drain awaits that pass rather than returning
      // instantly — processSyncQueue hands back the running promise.
      await processSyncQueue();
    } catch {
      // Reported through what is left in the outbox, not by rethrowing here.
    }

    const remaining = getPendingCount();
    setHasPendingSync(remaining > 0);
    return remaining;
  }, [isOnlineRef, delayRef, setHasPendingSync]);

  /**
   * Refreshes the failed-queue state from localStorage, which React cannot observe.
   *
   * Called even when nothing was queued: a direct write the server rejected records
   * its failure synchronously inside sendOrQueue without queueing anything, so
   * skipping this would leave the indicator count and the todo badge blind to it.
   *
   * The version bump is guarded because failedSyncVersion is a dependency of every
   * useFailedEntityIds memo — bumping it on each autosave and todo tick would
   * re-read localStorage, rebuild the id Set and re-render all four quadrant cards.
   * When the queue was empty before and is empty now, it cannot have changed.
   */
  const syncFailedState = useCallback(() => {
    const inspectable = getInspectableCount();
    if (inspectable > 0 || lastInspectableRef.current > 0) {
      setFailedSyncVersion((v) => v + 1);
    }

    lastInspectableRef.current = inspectable;
    setFailedSyncCount(inspectable);
  }, [setFailedSyncCount, setFailedSyncVersion]);

  /**
   * Drains the outbox, then pulls. `manual` marks a user-initiated sync.
   *
   * One function for both paths on purpose: the backoff effect and the manual
   * button share it, so a change to the drain semantics cannot apply to only one
   * of them. Rejects only for a manual sync that could not empty the outbox.
   */
  const drain = useCallback(async (manual: boolean) => {
    const hadQueuedWork = getPendingCount() > 0;
    const remaining = await push(manual);
    syncFailedState();

    if (!isOnlineRef.current) {
      return;
    }

    if (remaining > 0) {
      // A manual sync that leaves work queued did not do what the user asked, and
      // this is the only honest signal for it: processSyncQueue RESOLVES even when
      // it gave up — a 5xx pauses the drain rather than rejecting — so waiting for
      // an exception from it would never surface the case the button exists for.
      if (manual) {
        throw new Error('Sync incomplete: outbox still has entries');
      }

      return;
    }

    // Nothing queued and nobody asked: the direct write already returned the
    // server's row, so there is nothing left to pull.
    if (!hadQueuedWork && !manual) {
      return;
    }

    await refreshFromServer().catch(() => {
      // offline — ignore
    });
  }, [isOnlineRef, push, syncFailedState, refreshFromServer]);

  /** User-initiated: push whatever is queued, then pull. Rejects if the push failed. */
  const syncNow = useCallback(() => drain(true), [drain]);

  /** Fired after every mutation — arms the retry loop, never pulls on its own. */
  const syncPending = useCallback(() => {
    void drain(false);
  }, [drain]);

  return { drain, syncNow, syncPending };
}
