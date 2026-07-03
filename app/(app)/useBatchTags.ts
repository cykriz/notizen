'use client';

import { replaceFolderTag } from '@/lib/tagTree';
import { useCallback } from 'react';
import { useData } from './dataContext';

// Shared batch operation for the multi-note drop and the "Tags vergeben" popover:
// for each id, replace the `from` folder tag with `targets` (or just add them when
// from=''), then dispatch all changes in ONE offline-aware updateNotes call so the
// optimistic state and offline cache stay correct. Reads the raw useData().notes
// (replaceFolderTag strips the synthetic FAILED_SYNC_TAG either way).
export function useBatchTags() {
  const { notes, updateNotes } = useData();

  const applyFolderTag = useCallback(
    (ids: string[], from: string, targets: string[]) => {
      const updates = ids
        .map((id) => {
          const note = notes.find((n) => n.id === id);
          const next = note ? replaceFolderTag(note.tags, from, targets) : null;
          return next ? { id, input: { tags: next } } : null;
        })
        .filter((u) => u !== null);

      if (updates.length > 0) {
        void updateNotes(updates).catch(() => {
          // Network error — retried on the next sync
        });
      }
    },
    [notes, updateNotes],
  );

  return { applyFolderTag };
}
