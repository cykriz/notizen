export interface NoteSummary {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
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

export const QUADRANT_KEYS = ["do", "schedule", "delegate", "eliminate"] as const;

export type TodoQuadrant = (typeof QUADRANT_KEYS)[number];

export interface QuadrantMeta {
  key: TodoQuadrant;
  label: string;
  description: string;
}

export const QUADRANT_META: readonly QuadrantMeta[] = [
  { key: "do", label: "Erledigen", description: "Wichtig & Dringend" },
  { key: "schedule", label: "Einplanen", description: "Wichtig & Nicht dringend" },
  { key: "delegate", label: "Delegieren", description: "Nicht wichtig & Dringend" },
  { key: "eliminate", label: "Verwerfen", description: "Nicht wichtig & Nicht dringend" },
];

export interface Todo {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  quadrant: TodoQuadrant;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}
