import fs from 'fs/promises';
import path from 'path';
import type { Todo } from './types';
import { ensureDir } from './fsHelpers';
import { toUsableQuadrant } from './quadrantAlias';

// The todos.json file layer, split out of fsTodos.ts to keep it under the
// 200-line cap. All todos for one user live in a single JSON array.

function todosPath(root: string): string {
  return path.join(root, 'todos.json');
}

/**
 * Normalises every stored quadrant on read — toUsableQuadrant owns the rule.
 *
 * Nothing else repairs these values: the parse below is an unvalidated cast, so
 * GET /api/todos would serve them as-is, and UpdateTodoSchema only validates the
 * request body — a `{completed}` toggle merges straight over a stale row. Doing it
 * here means the next writeTodos persists the fix, so the file self-heals without
 * a migration script, and the server-rendered first paint agrees with the client
 * cache about every row.
 */
function normalizeQuadrants(todos: Todo[]): Todo[] {
  return todos.map((t) => {
    const usable = toUsableQuadrant(t.quadrant);
    return usable === t.quadrant ? t : { ...t, quadrant: usable };
  });
}

export async function readTodos(root: string): Promise<Todo[]> {
  try {
    const raw = await fs.readFile(todosPath(root), 'utf-8');
    return normalizeQuadrants(JSON.parse(raw) as Todo[]);
  } catch {
    return [];
  }
}

export async function writeTodos(todos: Todo[], root: string): Promise<void> {
  await ensureDir(root);
  await fs.writeFile(todosPath(root), JSON.stringify(todos, null, 2), 'utf-8');
}
