'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import type { NoteSummary } from '@/lib/types';
import { extractNoteId, getNoteTagPath } from '@/lib/noteUtils';
import { tagNavigationStore } from './tagNavigationStore';

interface TagState {
  lastSeenNoteTags: string[];
  tagNavVersion: number;
  path: string;
}

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

function isOnOrUnder(path: string, tags: string[]): boolean {
  return path !== '' && tags.some((t) => t === path || t.startsWith(`${path}/`));
}

interface UseTagStateSyncArgs {
  notes: NoteSummary[];
  pathname: string;
}

export function useTagStateSync({ notes, pathname }: UseTagStateSyncArgs) {
  const noteId = extractNoteId(pathname);
  const note = noteId !== null ? notes.find((n) => n.id === noteId) : undefined;
  const currentTags = note?.tags ?? [];

  const [tagState, setTagState] = useState<TagState>(() => ({
    lastSeenNoteTags: currentTags,
    tagNavVersion: 0,
    path: getNoteTagPath(notes, pathname),
  }));

  const tagNav = useSyncExternalStore(
    tagNavigationStore.subscribe,
    tagNavigationStore.getSnapshot,
    tagNavigationStore.getServerSnapshot,
  );

  // Render-time sync: a different note was opened — keep parent folder if it
  // already matches one of the note's tags, otherwise jump to the note's tag.
  // Guard on the note actually existing: when noteId is set but the note is gone
  // (just deleted) or not yet loaded (offline/initial), keep the current path so
  // the sidebar doesn't snap back to root.
  if (note !== undefined && !sameTags(currentTags, tagState.lastSeenNoteTags)) {
    // Tags changed (new note or same note with different tags) — refresh the baseline.
    // Re-target when the note gains its first tag (root-create-then-tag flow) or when
    // the current sidebar path has been orphaned; otherwise keep the user's browsing context.
    let path = tagState.path;
    if (tagState.lastSeenNoteTags.length === 0 && currentTags.length > 0) {
      // Gained first tag
      path = getNoteTagPath(notes, pathname);
    } else if (tagState.path !== '' && !isOnOrUnder(tagState.path, currentTags)) {
      // Path orphaned
      path = getNoteTagPath(notes, pathname);
    }

    setTagState((prev) => ({ ...prev, lastSeenNoteTags: currentTags, path }));
  }

  // Render-time sync: tag selected from the command palette — force-jump.
  if (tagNav.version > tagState.tagNavVersion) {
    setTagState((prev) => ({ ...prev, tagNavVersion: tagNav.version, path: tagNav.path }));
  }

  const setCurrentTagPath = useCallback((path: string) => {
    setTagState((prev) => ({ ...prev, path }));
  }, []);

  return { currentTagPath: tagState.path, setCurrentTagPath, noteId };
}
