import { z } from 'zod/v4';

// Stored quadrant values. 'delegate' is the persisted value of the "Eingang" (inbox)
// quadrant (QUADRANT.INBOX) — kept as-is so existing todos need no migration.
const TodoQuadrantSchema = z.enum(['do', 'schedule', 'delegate', 'planned']);

const AttachmentSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  relativePath: z.string(),
});

const NoteSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  attachmentCount: z.number(),
  tags: z.array(z.string()),
  pinned: z.boolean(),
});

const NoteSchema = NoteSummarySchema.extend({
  content: z.string(),
  attachments: z.array(AttachmentSchema),
});

const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  linkedNoteIds: z.array(z.string()).optional(),
  quadrant: TodoQuadrantSchema,
  completed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const NoteSummaryArraySchema = z.array(NoteSummarySchema);
export const NoteResponseSchema = NoteSchema;
export const ConflictResponseSchema = z.object({
  error: z.string(),
  serverVersion: z.object({ updatedAt: z.string() }),
});
export const TodoArraySchema = z.array(TodoSchema);
export const TodoResponseSchema = TodoSchema;

// --- Papierkorb (Trash) ---
// The /api/trash response is fetched directly by TrashView (not through the
// active-list merge), so it needs its own schema carrying `trashedAt`.
const TrashedNoteSchema = NoteSummarySchema.extend({ trashedAt: z.string() });
const TrashedTodoSchema = TodoSchema.extend({ trashedAt: z.string() });
export const TrashResponseSchema = z.object({
  retentionDays: z.number(),
  notes: z.array(TrashedNoteSchema),
  todos: z.array(TrashedTodoSchema),
});
export const UserSettingsSchema = z.object({ retentionDays: z.number() });
