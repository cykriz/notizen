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
import { deleteTagFolderOffline } from '@/lib/offlineTagFolder';
import {
  type CreateTodoInput,
  type UpdateTodoInput,
  createTodoOffline,
  deleteTodoOffline,
  updateTodoOffline,
} from '@/lib/offlineTodos';
import {
  getCachedNote,
  getCachedNotesList,
  getCachedTodos,
  setCachedNotesList,
  setCachedTodos,
} from '@/lib/localCache';
import { cleanExpiredEntries, mergeById } from '@/lib/localCacheMerge';
import { getPendingCount } from '@/lib/syncQueue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useDataSync } from '@/hooks/useDataSync';
import { DataContext } from './dataContext';

export { useData } from './dataContext';

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

  const { hasPendingSync, setHasPendingSync, failedSyncCount, clearFailed, refreshFromServer, syncPending } = useDataSync({
    isOnline,
    isOnlineRef,
    setNotes,
    setTodos,
  });

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

  const handleDeleteNote = useCallback(async (id: string) => {
    setNotes(await deleteNoteOffline(id, notesRef.current, isOnlineRef.current));
    syncPending();
  }, [syncPending]);

  const handleDeleteTagFolder = useCallback(async (path: string) => {
    setNotes(await deleteTagFolderOffline(path, notesRef.current, isOnlineRef.current));
    syncPending();
  }, [syncPending]);

  const handleCreateTodo = useCallback(async (input: CreateTodoInput): Promise<Todo> => {
    const { todo, updatedList } = await createTodoOffline(input, todosRef.current, isOnlineRef.current);
    setTodos(updatedList);
    syncPending();
    return todo;
  }, [syncPending]);

  const handleUpdateTodo = useCallback(async (id: string, input: UpdateTodoInput) => {
    setTodos(await updateTodoOffline(id, input, todosRef.current, isOnlineRef.current));
    syncPending();
  }, [syncPending]);

  const handleDeleteTodo = useCallback(async (id: string) => {
    setTodos(await deleteTodoOffline(id, todosRef.current, isOnlineRef.current));
    syncPending();
  }, [syncPending]);

  return (
    <DataContext.Provider
      value={{
        notes,
        todos,
        isOnline,
        hasPendingSync,
        failedSyncCount,
        clearFailedSync: clearFailed,
        createNote: handleCreateNote,
        updateNote: handleUpdateNote,
        deleteNote: handleDeleteNote,
        deleteTagFolder: handleDeleteTagFolder,
        createTodo: handleCreateTodo,
        updateTodo: handleUpdateTodo,
        deleteTodo: handleDeleteTodo,
        getCachedNoteContent: getCachedNote,
        refreshFromServer,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
