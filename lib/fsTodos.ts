import { v4 as uuidv4 } from 'uuid';
import type { Todo, TodoQuadrant, TrashedTodo } from './types';
import { NotFoundError, withTodosLock } from './fsHelpers';
import { readTodos, writeTodos } from './fsTodosStore';

const DAY_MS = 24 * 60 * 60 * 1000;

export type { Todo, TodoQuadrant } from './types';

export async function listTodos(root: string): Promise<Todo[]> {
  const todos = (await readTodos(root)).filter((t) => t.trashedAt === undefined);
  todos.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return todos;
}

export async function getTodo(id: string, root: string): Promise<Todo | null> {
  const todos = await readTodos(root);
  const found = todos.find((t) => t.id === id);
  return found !== undefined && found.trashedAt === undefined ? found : null;
}

interface CreateTodoInput {
  title: string;
  quadrant: TodoQuadrant;
  description?: string;
  dueDate?: string;
  linkedNoteIds?: string[];
  id?: string;
}

export async function createTodo(input: CreateTodoInput, root: string): Promise<Todo> {
  return await withTodosLock(root, async () => {
    const todos = await readTodos(root);
    const now = new Date().toISOString();
    const id = input.id ?? uuidv4();
    const existing = todos.find((t) => t.id === id);
    if (existing !== undefined) {
      return existing;
    }

    const todo: Todo = {
      id,
      title: input.title,
      quadrant: input.quadrant,
      completed: false,
      createdAt: now,
      updatedAt: now,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      ...(input.linkedNoteIds !== undefined && { linkedNoteIds: input.linkedNoteIds }),
    };
    todos.push(todo);
    await writeTodos(todos, root);
    return todo;
  });
}

interface UpdateTodoInput {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  linkedNoteIds?: string[] | null;
  quadrant?: TodoQuadrant;
  completed?: boolean;
}

export async function updateTodo(id: string, input: UpdateTodoInput, root: string): Promise<Todo> {
  return await withTodosLock(root, async () => {
    const todos = await readTodos(root);
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new NotFoundError(`Todo not found: ${id}`);
    }

    if (todos[idx].trashedAt !== undefined) {
      throw new NotFoundError(`Todo not found: ${id}`);
    }

    const existing = todos[idx];
    const merged = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    const updated = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== null)) as unknown as Todo;
    todos[idx] = updated;
    await writeTodos(todos, root);
    return updated;
  });
}

// Soft-delete: stamp trashedAt so the todo moves to the trash. listTodos/getTodo
// hide it from the active list; restoreTodo clears the flag. updatedAt is left
// untouched so restore keeps the original ordering.
export async function deleteTodo(id: string, root: string): Promise<void> {
  await withTodosLock(root, async () => {
    const todos = await readTodos(root);
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1 || todos[idx].trashedAt !== undefined) {
      throw new NotFoundError(`Todo not found: ${id}`);
    }

    todos[idx] = { ...todos[idx], trashedAt: new Date().toISOString() };
    await writeTodos(todos, root);
  });
}

// --- Papierkorb (Trash) ---

export async function restoreTodo(id: string, root: string): Promise<void> {
  await withTodosLock(root, async () => {
    const todos = await readTodos(root);
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1 || todos[idx].trashedAt === undefined) {
      throw new NotFoundError(`Trashed todo not found: ${id}`);
    }

    const { trashedAt: _drop, ...rest } = todos[idx];
    todos[idx] = rest;
    await writeTodos(todos, root);
  });
}

export async function permanentlyDeleteTodo(id: string, root: string): Promise<void> {
  await withTodosLock(root, async () => {
    const todos = await readTodos(root);
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1 || todos[idx].trashedAt === undefined) {
      throw new NotFoundError(`Trashed todo not found: ${id}`);
    }

    todos.splice(idx, 1);
    await writeTodos(todos, root);
  });
}

export async function listTrashedTodos(root: string): Promise<TrashedTodo[]> {
  const trashed = (await readTodos(root)).filter((t): t is TrashedTodo => t.trashedAt !== undefined);
  trashed.sort((a, b) => new Date(b.trashedAt).getTime() - new Date(a.trashedAt).getTime());
  return trashed;
}

/** Permanently remove all trashed todos. Returns count removed. */
export async function emptyTodosTrash(root: string): Promise<number> {
  return await withTodosLock(root, async () => {
    const todos = await readTodos(root);
    const kept = todos.filter((t) => t.trashedAt === undefined);
    const removed = todos.length - kept.length;
    if (removed > 0) {
      await writeTodos(kept, root);
    }

    return removed;
  });
}

/** Delete trashed todos whose trashedAt is older than retentionDays. Returns count. */
export async function purgeExpiredTodos(root: string, retentionDays: number): Promise<number> {
  return await withTodosLock(root, async () => {
    const cutoff = Date.now() - retentionDays * DAY_MS;
    const todos = await readTodos(root);
    const kept = todos.filter(
      (t) => t.trashedAt === undefined || new Date(t.trashedAt).getTime() > cutoff,
    );
    const removed = todos.length - kept.length;
    if (removed > 0) {
      await writeTodos(kept, root);
    }

    return removed;
  });
}
