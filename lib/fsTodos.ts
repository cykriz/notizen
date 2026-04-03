import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Todo, TodoQuadrant } from './types';
import { ensureDir, withTodosLock } from './fsHelpers';

export type { Todo, TodoQuadrant } from './types';

function todosPath(root: string): string {
  return path.join(root, 'todos.json');
}

async function readTodos(root: string): Promise<Todo[]> {
  try {
    const raw = await fs.readFile(todosPath(root), 'utf-8');
    return JSON.parse(raw) as Todo[];
  } catch {
    return [];
  }
}

async function writeTodos(todos: Todo[], root: string): Promise<void> {
  await ensureDir(root);
  await fs.writeFile(todosPath(root), JSON.stringify(todos, null, 2), 'utf-8');
}

export async function listTodos(root: string): Promise<Todo[]> {
  const todos = await readTodos(root);
  todos.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return todos;
}

export async function getTodo(id: string, root: string): Promise<Todo | null> {
  const todos = await readTodos(root);
  return todos.find((t) => t.id === id) ?? null;
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
      throw new Error(`Todo not found: ${id}`);
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

export async function deleteTodo(id: string, root: string): Promise<void> {
  await withTodosLock(root, async () => {
    const todos = await readTodos(root);
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new Error(`Todo not found: ${id}`);
    }

    todos.splice(idx, 1);
    await writeTodos(todos, root);
  });
}
