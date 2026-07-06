'use client';

import { replaceFolderTag } from '@/lib/tagTree';
import { FAILED_SYNC_TAG, pathHasReservedSegment } from '@/lib/constants';
import { useCallback } from 'react';
import { useData } from './dataContext';

// Shared batch operations for the multi-note drop and the "Tags vergeben" popover.
// Both dispatch all changes in ONE offline-aware updateNotes call so the optimistic
// state and offline cache stay correct. They read the raw useData().notes and strip
// the synthetic FAILED_SYNC_TAG.
export function useBatchTags() {
  const { notes, updateNotes } = useData();

  const dispatch = useCallback(
    (updates: { id: string; input: { tags: string[] } }[]) => {
      if (updates.length > 0) {
        void updateNotes(updates).catch(() => {
          // Network error — retried on the next sync
        });
      }
    },
    [updateNotes],
  );

  // Drag-drop: replace the `from` folder tag with `targets` (or add when from='').
  const applyFolderTag = useCallback(
    (ids: string[], from: string, targets: string[]) => {
      dispatch(
        ids
          .map((id) => {
            const note = notes.find((n) => n.id === id);
            const next = note ? replaceFolderTag(note.tags, from, targets) : null;
            return next ? { id, input: { tags: next } } : null;
          })
          .filter((u) => u !== null),
      );
    },
    [notes, dispatch],
  );

  // "Tags vergeben" popover: on each selected note drop the `remove` tags (and the
  // synthetic FAILED_SYNC_TAG) and add the `add` tags, leaving every other tag on
  // the note untouched. Reserved targets are never persisted.
  const applyTagDiff = useCallback(
    (ids: string[], remove: string[], add: string[]) => {
      const removeSet = new Set([...remove, FAILED_SYNC_TAG]);
      const cleanAdd = add.filter((t) => !pathHasReservedSegment(t));
      dispatch(
        ids
          .map((id) => {
            const note = notes.find((n) => n.id === id);
            if (!note) {
              return null;
            }

            const next = [...note.tags.filter((t) => !removeSet.has(t) && !cleanAdd.includes(t)), ...cleanAdd];
            const unchanged = next.length === note.tags.length && next.every((t) => note.tags.includes(t));
            return unchanged ? null : { id, input: { tags: next } };
          })
          .filter((u) => u !== null),
      );
    },
    [notes, dispatch],
  );

  return { applyFolderTag, applyTagDiff };
}
