'use client';

import { useMemo } from 'react';
import { getInspectableEntries } from '@/lib/failedSyncQueue';
import type { SyncEntityType } from '@/lib/types';
import { useData } from './dataContext';

/**
 * Ids of one entity type whose sync has permanently failed.
 *
 * The queues live in localStorage, which React cannot observe, so the memo is
 * keyed on failedSyncVersion and hasPendingSync — the two reactive proxies for
 * them. The version bumps on every add/remove rather than only on a count
 * change, so a same-tick add+remove that nets out to equal length still
 * refreshes the set.
 */
export function useFailedEntityIds(entityType: SyncEntityType): ReadonlySet<string> {
  const { failedSyncVersion, hasPendingSync } = useData();

  return useMemo(
    () =>
      new Set(
        getInspectableEntries()
          .filter((e) => e.entityType === entityType)
          .map((e) => e.entityId),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- failedSyncVersion/hasPendingSync are the reactive proxies for the two queues
    [entityType, failedSyncVersion, hasPendingSync],
  );
}
