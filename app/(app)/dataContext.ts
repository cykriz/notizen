'use client';

import { createContext, useContext } from 'react';
import type { Note, NoteSummary, SyncEntityType, Todo } from '@/lib/types';
import type { CreateNoteInput, UpdateNoteInput } from '@/lib/offlineNotes';
import type { AttachmentChange } from '@/lib/offlineAttachments';
import type { CreateTodoInput, UpdateTodoInput } from '@/lib/offlineTodos';
import type { PushResult } from '@/hooks/useFailedSyncActions';

export interface DataContextValue {
  notes: NoteSummary[];
  todos: Todo[];
  isOnline: boolean;
  hasPendingSync: boolean;
  failedSyncCount: number;
  failedSyncVersion: number;
  // Makes the SERVER match local: replays the mutation, or re-creates / restores
  // first when the entity is gone server-side. Async because a 404 has to check
  // the trash before choosing. The result names what actually happened.
  pushFailedSync: (entityType: SyncEntityType, entityId: string) => Promise<PushResult>;
  // Discard also purges the local state the change would otherwise resurrect.
  discardFailedSync: (entityType: SyncEntityType, entityId: string) => void;
  discardAllFailedSync: () => void;
  createNote: (input: CreateNoteInput) => Promise<Note>;
  updateNote: (id: string, input: UpdateNoteInput) => Promise<void>;
  updateNotes: (updates: { id: string; input: UpdateNoteInput }[]) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  deleteTagFolder: (path: string) => Promise<void>;
  // Attachment mutations are network-only and never touch note.md, so no save
  // and no revalidate carries the new count into the sidebar — this does.
  attachmentChanged: (noteId: string, change: AttachmentChange) => void;
  createTodo: (input: CreateTodoInput) => Promise<Todo>;
  updateTodo: (id: string, input: UpdateTodoInput) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  // Restore a trashed note/todo (online-only): clears the tombstone + any queued
  // delete for the id, then re-pulls the active lists from the server.
  restoreFromTrash: (type: SyncEntityType, id: string) => Promise<void>;
  getCachedNoteContent: (id: string) => Note | null;
  refreshFromServer: () => Promise<void>;
  /** Re-read both sync queues from localStorage — they are invisible to React. */
  reseedFromQueues: () => void;
  // User-initiated sync: pushes the outbox first, THEN pulls. refreshFromServer
  // only pulls, which is why the indicator uses this one — a pending change
  // would otherwise sit there with no way to send it on demand.
  syncNow: () => Promise<void>;
}

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (ctx === null) {
    throw new Error('useData must be used within DataProvider');
  }

  return ctx;
}
