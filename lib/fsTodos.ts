import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Todo, TodoQuadrant } from "./types";
import { getNotesRoot, ensureDir } from "./fsHelpers";

export type { Todo, TodoQuadrant } from "./types";

function todosPath(): string {
  return path.join(getNotesRoot(), "todos.json");
}

async function readTodos(): Promise<Todo[]> {
  try {
    const raw = await fs.readFile(todosPath(), "utf-8");
    return JSON.parse(raw) as Todo[];
  } catch {
    return [];
  }
}

async function writeTodos(todos: Todo[]): Promise<void> {
  await ensureDir(getNotesRoot());
  await fs.writeFile(todosPath(), JSON.stringify(todos, null, 2), "utf-8");
}

export async function listTodos(): Promise<Todo[]> {
  const todos = await readTodos();
  todos.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return todos;
}

export async function getTodo(id: string): Promise<Todo | null> {
  const todos = await readTodos();
  return todos.find((t) => t.id === id) ?? null;
}

interface CreateTodoInput {
  title: string;
  quadrant: TodoQuadrant;
  description?: string;
  dueDate?: string;
  linkedNoteIds?: string[];
}

export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  const todos = await readTodos();
  const now = new Date().toISOString();
  const todo: Todo = {
    id: uuidv4(),
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
  await writeTodos(todos);
  return todo;
}

interface UpdateTodoInput {
  title?: string;
  description?: string;
  dueDate?: string;
  linkedNoteIds?: string[];
  quadrant?: TodoQuadrant;
  completed?: boolean;
}

export async function updateTodo(id: string, input: UpdateTodoInput): Promise<Todo> {
  const todos = await readTodos();
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) {
    throw new Error(`Todo not found: ${id}`);
  }

  const existing = todos[idx];
  const updated: Todo = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  todos[idx] = updated;
  await writeTodos(todos);
  return updated;
}

export async function deleteTodo(id: string): Promise<void> {
  const todos = await readTodos();
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) {
    throw new Error(`Todo not found: ${id}`);
  }

  todos.splice(idx, 1);
  await writeTodos(todos);
}
