export interface NoteSummary {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
  tags: string[];
  pinned: boolean;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  relativePath: string;
}

export interface Note extends NoteSummary {
  content: string;
  attachments: Attachment[];
}

export type PreviewMode = 'edit' | 'preview';

// TodoQuadrant is derived from the QUADRANT const via `typeof`, so the type
// must live in constants.ts next to the runtime value. Re-exported here so
// consumers can import all types from '@/lib/types'.
import type { TodoQuadrant } from './constants';
export type { TodoQuadrant };

export type SyncEntityType = 'note' | 'todo';
export type SyncAction = 'create' | 'update' | 'delete';

export interface QuadrantMeta {
  key: TodoQuadrant;
  label: string;
  description: string;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  linkedNoteIds?: string[];
  quadrant: TodoQuadrant;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}
