'use client';

import { useMemo } from 'react';
import { SYNC_ACTION } from '@/lib/constants';
import { type FailedSyncDetail, toFailedSyncDetails } from '@/lib/failedSyncDetail';
import { getInspectableEntries } from '@/lib/failedSyncQueue';
import { getSyncQueue } from '@/lib/localCache';
import { useData } from './dataContext';

/**
 * Derives the inspector's view model from localStorage.
 *
 * `failedSyncVersion` is the reactive proxy for the queue CONTENTS — the same
 * contract as AppSidebar. getInspectableEntries/getSyncQueue read localStorage,
 * which React cannot observe. `hasPendingSync` is a coarse second trigger for
 * the pending queue (it only flips on the empty/non-empty edge), which suffices:
 * a requeue out of an empty queue always flips it, and every failed-queue
 * mutation bumps the version.
 */
export function useFailedSyncDetails(enabled: boolean): FailedSyncDetail[] {
  const { notes, todos, hasPendingSync, failedSyncVersion, getCachedNoteContent } = useData();

  // Short-circuited while the dialog is closed: two instances stay mounted, and
  // the final memo depends on notes/todos, so every list refresh otherwise re-ran
  // toFailedSyncDetails (a localStorage read + Zod parse per entry) twice over for
  // a dialog nobody has open. `enabled` flips in the same commit as `open`, so the
  // list is populated on the first render that shows it.
  const entries = useMemo(
    () => (enabled ? getInspectableEntries() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- failedSyncVersion/hasPendingSync are the reactive proxies for the queues
    [enabled, failedSyncVersion, hasPendingSync],
  );

  const pendingIds = useMemo(
    () => (enabled ? new Set(getSyncQueue().map((e) => e.entityId)) : new Set<string>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
    [enabled, failedSyncVersion, hasPendingSync],
  );

  const unsyncedCreateIds = useMemo(
    () =>
      new Set(
        [...getSyncQueue(), ...entries]
          .filter((e) => e.action === SYNC_ACTION.CREATE)
          .map((e) => e.entityId),
      ),
    [entries],
  );

  return useMemo(
    () =>
      toFailedSyncDetails(entries, {
        notes,
        todos,
        getCachedNote: getCachedNoteContent,
        pendingIds,
        unsyncedCreateIds,
      }),
    [entries, notes, todos, getCachedNoteContent, pendingIds, unsyncedCreateIds],
  );
}
