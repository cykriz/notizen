'use client';

import { useCallback } from 'react';
import { tryFetch } from '@/lib/tryFetch';
import { clearPendingForEntity } from '@/lib/syncQueue';
import { removeTombstone } from '@/lib/localCacheMerge';
import type { SyncEntityType } from '@/lib/types';

// Restore a trashed note/todo (online-only). On success it drops any still-queued
// delete for the id and clears its tombstone (mergeById hides tombstoned ids for
// 7 days), then re-pulls the active lists so the item reappears.
export function useRestoreFromTrash(refreshFromServer: () => Promise<void>) {
  return useCallback(
    async (type: SyncEntityType, id: string) => {
      const res = await tryFetch(`/api/trash/${type}/${id}/restore`, { method: 'POST' });
      if (res?.ok !== true) {
        throw new Error('restore failed');
      }

      clearPendingForEntity(id);
      removeTombstone(id);
      await refreshFromServer();
    },
    [refreshFromServer],
  );
}
