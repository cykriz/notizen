'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import type { NoteSummary } from '@/lib/types';
import { extractNoteId, getNoteTagPath } from '@/lib/noteUtils';
import { resolveSidebarPath } from '@/lib/sidebarPath';
import { tagNavigationStore } from './tagNavigationStore';

interface TagState {
  lastSeenNoteId: string | null;
  lastSeenNoteTags: string[];
  tagNavVersion: number;
  path: string;
}

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

interface UseTagStateSyncArgs {
  notes: NoteSummary[];
  // Notes listed in the synthetic sync-fehler folder — `notes` itself carries no synthetic tag.
  failedNoteIds: ReadonlySet<string>;
  pathname: string;
}

export function useTagStateSync({ notes, failedNoteIds, pathname }: UseTagStateSyncArgs) {
  const noteId = extractNoteId(pathname);
  const note = noteId !== null ? notes.find((n) => n.id === noteId) : undefined;

  const [tagState, setTagState] = useState<TagState>(() => ({
    lastSeenNoteId: note?.id ?? null,
    lastSeenNoteTags: note?.tags ?? [],
    tagNavVersion: 0,
    path: getNoteTagPath(notes, pathname),
  }));

  const tagNav = useSyncExternalStore(
    tagNavigationStore.subscribe,
    tagNavigationStore.getSnapshot,
    tagNavigationStore.getServerSnapshot,
  );

  // Render-time sync: another note was opened, or the open note's tags changed (moved via the
  // header) — follow it unless it is still listed in the current folder.
  // Guard on the note actually existing: when noteId is set but the note is gone (just
  // deleted) or not yet loaded (offline/initial), keep the current path so the sidebar doesn't
  // snap back to root. The baseline is only advanced here, so a note that shows up late still
  // syncs once it appears.
  if (note !== undefined && (note.id !== tagState.lastSeenNoteId || !sameTags(note.tags, tagState.lastSeenNoteTags))) {
    const path = resolveSidebarPath(tagState.path, note, failedNoteIds.has(note.id));
    setTagState((prev) => ({ ...prev, lastSeenNoteId: note.id, lastSeenNoteTags: note.tags, path }));
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
