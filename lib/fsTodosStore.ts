import fs from 'fs/promises';
import path from 'path';
import type { Todo } from './types';
import { ensureDir } from './fsHelpers';
import { toUsableQuadrant } from './quadrantAlias';
import { enforceDoLimit } from './todoColumns';

// The todos.json file layer, split out of fsTodos.ts to keep it under the
// 200-line cap. All todos for one user live in a single JSON array.

function todosPath(root: string): string {
  return path.join(root, 'todos.json');
}

/**
 * Repairs stored todos on read: per-row quadrant rescue (toUsableQuadrant owns that
 * rule) plus the list-level WIP cap (enforceDoLimit owns that one).
 *
 * Nothing else repairs these values: the parse below is an unvalidated cast, so
 * GET /api/todos would serve them as-is, and UpdateTodoSchema only validates the
 * request body — a `{completed}` toggle merges straight over a stale row. Doing it
 * here means the next writeTodos persists the fix, so the file self-heals without
 * a migration script, and the server-rendered first paint agrees with the client
 * cache about every row.
 *
 * The WIP cap runs HERE ONLY, not in the client parser: the UI gate (canEnterDo)
 * stops a surplus from arising, and lib/schemas.ts parses before useDataSync merges
 * server and cache, so a client-side cap would police a list that is not the final
 * one anyway. The correction arrives with the server data instead.
 */
function normalizeTodos(todos: Todo[]): Todo[] {
  const rescued = todos.map((t) => {
    const usable = toUsableQuadrant(t.quadrant);
    return usable === t.quadrant ? t : { ...t, quadrant: usable };
  });
  return enforceDoLimit(rescued);
}

export async function readTodos(root: string): Promise<Todo[]> {
  try {
    const raw = await fs.readFile(todosPath(root), 'utf-8');
    return normalizeTodos(JSON.parse(raw) as Todo[]);
  } catch {
    return [];
  }
}

export async function writeTodos(todos: Todo[], root: string): Promise<void> {
  await ensureDir(root);
  await fs.writeFile(todosPath(root), JSON.stringify(todos, null, 2), 'utf-8');
}
