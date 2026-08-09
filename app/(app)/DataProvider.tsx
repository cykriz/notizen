'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note, NoteSummary, Todo } from '@/lib/types';
import {
  type CreateNoteInput,
  type UpdateNoteInput,
  createNoteOffline,
  deleteNoteOffline,
  updateNoteOffline,
} from '@/lib/offlineNotes';
import { batchUpdateNotesOffline, foldNoteUpdates } from '@/lib/offlineNotesBatch';
import { deleteTagFolderOffline } from '@/lib/offlineTagFolder';
import {
  getCachedNote,
  getCachedNotesList,
  getCachedTodos,
  setCachedNotesList,
  setCachedTodos,
} from '@/lib/localCache';
import { cleanExpiredEntries, mergeById } from '@/lib/localCacheMerge';
import { getPendingCount } from '@/lib/syncQueue';
import { OFFLINE_SHELL_PATH } from '@/lib/constants';
import { warmPageCache } from '@/lib/warmPageCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useDataSync } from '@/hooks/useDataSync';
import { DataContext } from './dataContext';
import { useRestoreFromTrash } from './useRestoreFromTrash';
import { useTodoActions } from './useTodoActions';
import { sharedNotesStore } from './sharedNotesStore';

interface DataProviderProps {
  initialNotes: NoteSummary[];
  initialTodos: Todo[];
  children: React.ReactNode;
}

export function DataProvider({ initialNotes, initialTodos, children }: DataProviderProps) {
  const [notes, setNotes] = useState<NoteSummary[]>(initialNotes);
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const { isOnline } = useOnlineStatus();
  const notesRef = useRef(notes);
  const todosRef = useRef(todos);
  const isOnlineRef = useRef(isOnline);
  notesRef.current = notes;
  todosRef.current = todos;
  isOnlineRef.current = isOnline;

  const { hasPendingSync, setHasPendingSync, failedSyncCount, failedSyncVersion, pushFailedSync, discardFailedSync, discardAllFailedSync, refreshFromServer, syncPending, syncNow } = useDataSync({
    isOnline,
    isOnlineRef,
    setNotes,
    setTodos,
  });

  // Re-pull shares on the sync-queue drain edge so mutations applied during sync land in the sidebar.
  // Only refresh once the store has been hydrated — users who never opened the dialog or shared
  // anything keep `snapshot === null` and skip a server call after every sync drain.
  const prevPendingSync = useRef(hasPendingSync);
  useEffect(() => {
    if (
      prevPendingSync.current &&
      !hasPendingSync &&
      sharedNotesStore.getSnapshot() !== null
    ) {
      void sharedNotesStore.refresh();
    }

    prevPendingSync.current = hasPendingSync;
  }, [hasPendingSync]);

  useEffect(() => {
    const cachedNotes = getCachedNotesList();
    const cachedTodos = getCachedTodos();
    const mergedNotes = mergeById(initialNotes, cachedNotes);
    setNotes(mergedNotes);
    setCachedNotesList(mergedNotes);

    const mergedTodos = mergeById(initialTodos, cachedTodos);
    setTodos(mergedTodos);
    setCachedTodos(mergedTodos);

    cleanExpiredEntries();
    setHasPendingSync(getPendingCount() > 0);
    // Not redundant with install-time precache: that only stores the shell
    // HTML, NOT its `/notes/[id]` chunks. The static cache is build-versioned
    // (static-<buildId>), so it's empty after every deploy until something
    // warms it. This re-warm fills the shell's chunks into the new build's
    // static cache (warmStaticAssets skips already-cached ones), so an offline
    // nav to a never-cached note — e.g. one created offline — boots the SPA via
    // the shell instead of hitting a missing chunk / the dead-end /offline page.
    warmPageCache(OFFLINE_SHELL_PATH);
    const ttlTimer = setTimeout(() => {
      cleanExpiredEntries();
    }, 24 * 60 * 60 * 1000);
    return () => {
      clearTimeout(ttlTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  const handleCreateNote = useCallback(async (input: CreateNoteInput): Promise<Note> => {
    const { note, updatedList } = await createNoteOffline(input, notesRef.current, isOnlineRef.current);
    setNotes(updatedList);
    syncPending();
    return note;
  }, [syncPending]);

  const handleUpdateNote = useCallback(async (id: string, input: UpdateNoteInput) => {
    setNotes(await updateNoteOffline(id, input, notesRef.current, isOnlineRef.current));
    syncPending();
  }, [syncPending]);

  const handleUpdateNotes = useCallback(async (updates: { id: string; input: UpdateNoteInput }[]) => {
    // Show the optimistic result immediately, then reconcile with the settled list
    // once the sequential per-note network calls resolve (both fold from the same base).
    setNotes(foldNoteUpdates(updates, notesRef.current));
    setNotes(await batchUpdateNotesOffline(updates, notesRef.current, isOnlineRef.current));
    syncPending();
  }, [syncPending]);

  const handleDeleteNote = useCallback(async (id: string) => {
    setNotes(await deleteNoteOffline(id, notesRef.current, isOnlineRef.current));
    sharedNotesStore.removeByNoteId(id);
    syncPending();
  }, [syncPending]);

  const handleDeleteTagFolder = useCallback(async (path: string) => {
    const before = notesRef.current;
    const after = await deleteTagFolderOffline(path, before, isOnlineRef.current);
    setNotes(after);
    const survivingIds = new Set(after.map((n) => n.id));
    for (const n of before) {
      if (!survivingIds.has(n.id)) {
        sharedNotesStore.removeByNoteId(n.id);
      }
    }

    if (isOnlineRef.current) {
      void sharedNotesStore.refresh();
    }

    syncPending();
  }, [syncPending]);

  const todoActions = useTodoActions({ todosRef, isOnlineRef, setTodos, syncPending });
  const restoreFromTrash = useRestoreFromTrash(refreshFromServer);

  return (
    <DataContext.Provider
      value={{
        notes,
        todos,
        isOnline,
        hasPendingSync,
        failedSyncCount,
        failedSyncVersion,
        pushFailedSync,
        discardFailedSync,
        discardAllFailedSync,
        createNote: handleCreateNote,
        updateNote: handleUpdateNote,
        updateNotes: handleUpdateNotes,
        deleteNote: handleDeleteNote,
        deleteTagFolder: handleDeleteTagFolder,
        ...todoActions,
        restoreFromTrash,
        getCachedNoteContent: getCachedNote,
        refreshFromServer,
        syncNow,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
