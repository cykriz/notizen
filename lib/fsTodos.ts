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
  };
  todos.push(todo);
  await writeTodos(todos);
  return todo;
}

interface UpdateTodoInput {
  title?: string;
  description?: string;
  dueDate?: string;
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

/* eslint-disable no-console */
async function runTests() {
  const sep = "─".repeat(50);
  console.log(`\n${sep}\n  fsTodos Inline Tests\n${sep}\n`);

  const originalRoot = process.env.NOTES_ROOT;
  const testRoot = path.join(process.cwd(), `.test-todos-${String(Date.now())}`);
  process.env.NOTES_ROOT = testRoot;

  try {
    const todo = await createTodo({ title: "Test", quadrant: "do", description: "desc" });
    if (todo.id === "" || todo.title !== "Test" || todo.quadrant !== "do") {
      throw new Error("createTodo fields wrong");
    }

    console.log("✓ createTodo — fields correct");

    const all = await listTodos();
    if (all.length !== 1) {
      throw new Error(`Expected 1 todo, got ${String(all.length)}`);
    }

    console.log("✓ listTodos — found 1 todo");

    const fetched = await getTodo(todo.id);
    if (fetched?.description !== "desc") {
      throw new Error("getTodo description mismatch");
    }

    console.log("✓ getTodo — description matches");

    const updated = await updateTodo(todo.id, { title: "Updated", completed: true });
    if (updated.title !== "Updated" || !updated.completed) {
      throw new Error("updateTodo fields wrong");
    }

    console.log("✓ updateTodo — title and completed updated");

    await deleteTodo(todo.id);
    const afterDelete = await listTodos();
    if (afterDelete.length !== 0) {
      throw new Error("Todo not deleted");
    }

    console.log("✓ deleteTodo — todo removed");

    console.log(`\n${sep}\n  ALL TESTS PASSED ✓\n${sep}\n`);
  } finally {
    process.env.NOTES_ROOT = originalRoot;
    await fs.rm(testRoot, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("fsTodos.ts")) {
  runTests().catch((err: unknown) => {
    console.error("\n  TEST FAILED ✗", err);
    process.exit(1);
  });
}
