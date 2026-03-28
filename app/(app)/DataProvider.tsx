'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note, NoteSummary, Todo } from '@/lib/types';
import { NoteSummaryArraySchema, TodoArraySchema } from '@/lib/schemas';
import {
  type CreateNoteInput,
  type UpdateNoteInput,
  createNoteOffline,
  deleteNoteOffline,
  updateNoteOffline,
} from '@/lib/offlineNotes';
import {
  type CreateTodoInput,
  type UpdateTodoInput,
  createTodoOffline,
  deleteTodoOffline,
  updateTodoOffline,
} from '@/lib/offlineTodos';
import {
  cleanExpiredEntries,
  getCachedNote,
  getCachedNotesList,
  getCachedTodos,
  mergeById,
  setCachedNotesList,
  setCachedTodos,
} from '@/lib/localCache';
import { getPendingCount, processSyncQueue } from '@/lib/syncQueue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
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
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const { isOnline } = useOnlineStatus();
  // Refs mirror state so useCallback closures always read the latest values
  // without needing state in dependency arrays (which would recreate callbacks on every change).
  const notesRef = useRef(notes);
  const todosRef = useRef(todos);
  const isOnlineRef = useRef(isOnline);
  notesRef.current = notes;
  todosRef.current = todos;
  isOnlineRef.current = isOnline;

  useEffect(() => {
    // Merge SSR data with any offline-created items still in localStorage.
    // SSR may come from the live server or from SW cache (stale). Either way,
    // items pending in the sync queue only exist in localStorage and must be preserved.
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

  const refreshFromServer = useCallback(async () => {
    // Skip when offline — GET responses would come from SW cache (stale)
    // and overwrite the correctly merged localStorage state.
    if (!isOnlineRef.current) {
      return;
    }

    try {
      // Verify server reachability (SW may serve stale cached API data)
      const health = await fetch('/api/health', { method: 'POST' }).then(
        (r) => r.ok ? r.json() as Promise<{ app?: string }> : null,
      ).catch(() => null);

      if (health?.app !== 'notizen') {
        return;
      }

      const [notesRes, todosRes] = await Promise.all([fetch('/api/notes'), fetch('/api/todos')]);
      if (notesRes.ok) {
        const serverNotes = NoteSummaryArraySchema.parse(await notesRes.json());
        setNotes(serverNotes);
        setCachedNotesList(serverNotes);
      }

      if (todosRes.ok) {
        const serverTodos = TodoArraySchema.parse(await todosRes.json());
        setTodos(serverTodos);
        setCachedTodos(serverTodos);
      }

    } catch {
      // offline — ignore
    }
  }, []);

  useEffect(() => {
    if (!isOnline || getPendingCount() === 0) {
      return;
    }

    void (async () => {
      try {
        await processSyncQueue();
      } catch (err) {
        console.error('Sync queue processing failed:', err);
      }

      const remaining = getPendingCount();
      setHasPendingSync(remaining > 0);

      if (remaining === 0) {
        try {
          await refreshFromServer();
        } catch (err) {
          console.error('Server refresh failed:', err);
        }
      }
    })();
  }, [isOnline, refreshFromServer]);

  const syncPending = useCallback(() => {
    const count = getPendingCount();
    setHasPendingSync(count > 0);
    if (count > 0 && isOnlineRef.current) {
      void (async () => {
        try {
          await processSyncQueue();
        } catch {
          // retry on next trigger
        }

        setHasPendingSync(getPendingCount() > 0);
      })();
    }
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
        createNote: handleCreateNote,
        updateNote: handleUpdateNote,
        deleteNote: handleDeleteNote,
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
