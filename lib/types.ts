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

export type TodoQuadrant = 'do' | 'schedule' | 'delegate' | 'planned';

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
