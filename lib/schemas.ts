import { z } from 'zod/v4';
import { QUADRANT_KEYS } from './constants';
import { toUsableQuadrant } from './quadrantAlias';
import type { NoteSummary, Todo } from './types';

// Stored quadrant values, derived from QUADRANT (single source of truth in lib/constants.ts).
const TodoQuadrantSchema = z.enum(QUADRANT_KEYS);

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

export const NoteResponseSchema = NoteSchema;
export const ConflictResponseSchema = z.object({
  error: z.string(),
  serverVersion: z.object({ updatedAt: z.string() }),
});
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

// --- Row-wise parsing ---
//
// The previous whole-array parse failed wholesale: one unparseable row discarded
// the ENTIRE cached list, and on a server response it threw inside a
// `catch { /* offline */ }`, silently killing every future pull. A single
// pre-cd9392c 'delegate' row was enough to trigger both. Parsing row by row
// keeps the good data and quarantines only what is actually broken — the same
// judgement failedSyncPayload makes about the failed queue.

// Bad rows are usually permanent, and these run on every cache read (mergeById,
// failedSyncPush, provider init). Logging each one every time would flood the
// console, so each distinct row is reported once per session. Keyed on the
// preview alone — the same broken row at a different index is the same problem,
// and including the index would both re-report it and grow the Set unboundedly.
const reportedParseErrors = new Set<string>();

/** Narrowed to objects before stringifying: JSON.stringify returns undefined for
 *  undefined/function/symbol, which are exactly the kinds of value that end up
 *  here. On a non-null object it always returns a string. */
function preview(value: unknown): string {
  const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
  return text.slice(0, 120);
}

function reportOnce(key: string, message: string): void {
  if (reportedParseErrors.has(key)) {
    return;
  }

  reportedParseErrors.add(key);
  console.error(message);
}

/**
 * A response we wrote successfully but cannot read back — a client/server schema
 * drift. Deduped like row errors, since a drift persists across every write.
 */
export function reportUnreadableResponse(scope: string, body: unknown): void {
  const text = preview(body);
  reportOnce(`${scope}:${text}`, `${scope}: server response did not match the schema — ${text}`);
}

function parseRows<T>(raw: unknown, scope: string, parse: (row: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const rows: T[] = [];
  raw.forEach((row, index) => {
    const parsed = parse(row);
    if (parsed === null) {
      const text = preview(row);
      reportOnce(`${scope}:${text}`, `${scope}: dropping unparseable row ${index.toString()} — ${text}`);
      return;
    }

    rows.push(parsed);
  });

  return rows;
}

/** Shape guard around toUsableQuadrant, which owns the rule. */
function normalizeQuadrant(row: unknown): unknown {
  if (typeof row !== 'object' || row === null || !('quadrant' in row)) {
    return row;
  }

  const { quadrant } = row as { quadrant: unknown };
  if (typeof quadrant !== 'string') {
    return row;
  }

  const usable = toUsableQuadrant(quadrant);
  return usable === quadrant ? row : { ...row, quadrant: usable };
}

const parseTodoRow = (row: unknown): Todo | null => {
  const parsed = TodoSchema.safeParse(normalizeQuadrant(row));
  return parsed.success ? parsed.data : null;
};

const parseNoteSummaryRow = (row: unknown): NoteSummary | null => {
  const parsed = NoteSummarySchema.safeParse(row);
  return parsed.success ? parsed.data : null;
};

// --- Lenient: for cache reads, where salvaging what is readable is the point ---

export function parseTodoRows(raw: unknown): Todo[] {
  return parseRows(raw, 'parseTodoRows', parseTodoRow);
}

export function parseNoteSummaryRows(raw: unknown): NoteSummary[] {
  return parseRows(raw, 'parseNoteSummaryRows', parseNoteSummaryRow);
}

// --- Strict: for server responses, where [] is a destructive answer ---
//
// A merge treats [] as "the server has nothing", drops every cache row without a
// pending or failed entry, and writes the empty list back — so an unreadable 200
// (an HTML error page, a stale service-worker entry, a shape the client no longer
// understands) would destroy the offline cache. The whole-array .parse() these
// replaced threw into refreshFromServer's catch and left the cache alone; these
// restore that safety without giving up row-wise salvage.
//
// The guard is deliberately "input was unusable", not "result is empty": deleting
// the last note is a legitimate empty response and must still merge.

function parseServerRows<T>(
  raw: unknown,
  scope: string,
  parse: (row: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const rows = parseRows(raw, scope, parse);
  return raw.length > 0 && rows.length === 0 ? null : rows;
}

/** null = the payload was not a usable list; the caller must skip the merge. */
export function parseTodoRowsStrict(raw: unknown): Todo[] | null {
  return parseServerRows(raw, 'parseTodoRowsStrict', parseTodoRow);
}

/** null = the payload was not a usable list; the caller must skip the merge. */
export function parseNoteSummaryRowsStrict(raw: unknown): NoteSummary[] | null {
  return parseServerRows(raw, 'parseNoteSummaryRowsStrict', parseNoteSummaryRow);
}
