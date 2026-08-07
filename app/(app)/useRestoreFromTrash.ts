'use client';

import { useCallback } from 'react';
import { restoreTrashedEntity } from '@/lib/trashRecovery';
import type { SyncEntityType } from '@/lib/types';

// Restore a trashed note/todo (online-only). restoreTrashedEntity drops any
// still-queued delete for the id and clears its tombstone (mergeById hides
// tombstoned ids for 7 days); this then re-pulls the active lists so the item
// reappears. Shared with the failed-sync inspector's push path, which restores
// before re-uploading so a 404'd note is never duplicated server-side.
export function useRestoreFromTrash(refreshFromServer: () => Promise<void>) {
  return useCallback(
    async (type: SyncEntityType, id: string) => {
      if (!(await restoreTrashedEntity(type, id))) {
        throw new Error('restore failed');
      }

      await refreshFromServer();
    },
    [refreshFromServer],
  );
}
