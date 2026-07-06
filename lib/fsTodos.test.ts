import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import fs from 'fs/promises';
import path from 'path';
import {
  createTodo,
  listTodos,
  getTodo,
  updateTodo,
  deleteTodo,
  restoreTodo,
  permanentlyDeleteTodo,
  listTrashedTodos,
  purgeExpiredTodos,
} from './fsTodos';

describe('fsTodos', () => {
  const originalRoot = process.env.NOTES_ROOT;
  const testRoot = path.join(process.cwd(), `.test-todos-${String(Date.now())}`);
  let todo: Awaited<ReturnType<typeof createTodo>>;

  beforeAll(async () => {
    process.env.NOTES_ROOT = testRoot;
    todo = await createTodo({ title: 'Test', quadrant: 'do', description: 'desc' }, testRoot);
  });

  afterAll(async () => {
    if (originalRoot === undefined) {
      delete process.env.NOTES_ROOT;
    } else {
      process.env.NOTES_ROOT = originalRoot;
    }

    await fs.rm(testRoot, { recursive: true, force: true });
  });

  test('createTodo — fields correct', () => {
    expect(todo.id).not.toBe('');
    expect(todo.title).toBe('Test');
    expect(todo.quadrant).toBe('do');
  });

  test('listTodos — found 1 todo', async () => {
    const all = await listTodos(testRoot);
    expect(all).toHaveLength(1);
  });

  test('getTodo — description matches', async () => {
    const fetched = await getTodo(todo.id, testRoot);
    expect(fetched?.description).toBe('desc');
  });

  test('updateTodo — title and completed updated', async () => {
    const updated = await updateTodo(todo.id, { title: 'Updated', completed: true }, testRoot);
    expect(updated.title).toBe('Updated');
    expect(updated.completed).toBe(true);
  });

  test('deleteTodo — moved to trash (soft delete)', async () => {
    await deleteTodo(todo.id, testRoot);
    expect(await listTodos(testRoot)).toHaveLength(0);
    expect(await getTodo(todo.id, testRoot)).toBeNull();
    const trashed = await listTrashedTodos(testRoot);
    expect(trashed).toHaveLength(1);
    expect(trashed[0].id).toBe(todo.id);
  });

  test('restoreTodo — back in active list', async () => {
    await restoreTodo(todo.id, testRoot);
    expect(await listTodos(testRoot)).toHaveLength(1);
    expect(await listTrashedTodos(testRoot)).toHaveLength(0);
  });

  test('permanentlyDeleteTodo — gone for good', async () => {
    await deleteTodo(todo.id, testRoot);
    await permanentlyDeleteTodo(todo.id, testRoot);
    expect(await listTodos(testRoot)).toHaveLength(0);
    expect(await listTrashedTodos(testRoot)).toHaveLength(0);
  });

  test('purgeExpiredTodos — removes expired trashed todos', async () => {
    const t = await createTodo({ title: 'PurgeMe', quadrant: 'do' }, testRoot);
    await deleteTodo(t.id, testRoot);
    expect(await listTrashedTodos(testRoot)).toHaveLength(1);
    const removed = await purgeExpiredTodos(testRoot, 0);
    expect(removed).toBe(1);
    expect(await listTrashedTodos(testRoot)).toHaveLength(0);
  });
});
