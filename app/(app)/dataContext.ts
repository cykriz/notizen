'use client';

import { createContext, useContext } from 'react';
import type { Note, NoteSummary, SyncEntityType, Todo } from '@/lib/types';
import type { CreateNoteInput, UpdateNoteInput } from '@/lib/offlineNotes';
import type { CreateTodoInput, UpdateTodoInput } from '@/lib/offlineTodos';

export interface DataContextValue {
  notes: NoteSummary[];
  todos: Todo[];
  isOnline: boolean;
  hasPendingSync: boolean;
  failedSyncCount: number;
  failedSyncVersion: number;
  clearFailedSync: () => void;
  createNote: (input: CreateNoteInput) => Promise<Note>;
  updateNote: (id: string, input: UpdateNoteInput) => Promise<void>;
  updateNotes: (updates: { id: string; input: UpdateNoteInput }[]) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  deleteTagFolder: (path: string) => Promise<void>;
  createTodo: (input: CreateTodoInput) => Promise<Todo>;
  updateTodo: (id: string, input: UpdateTodoInput) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  // Restore a trashed note/todo (online-only): clears the tombstone + any queued
  // delete for the id, then re-pulls the active lists from the server.
  restoreFromTrash: (type: SyncEntityType, id: string) => Promise<void>;
  getCachedNoteContent: (id: string) => Note | null;
  refreshFromServer: () => Promise<void>;
}

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (ctx === null) {
    throw new Error('useData must be used within DataProvider');
  }

  return ctx;
}
