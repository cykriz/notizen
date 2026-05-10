import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import fs from 'fs/promises';
import path from 'path';
import { createTodo, listTodos, getTodo, updateTodo, deleteTodo } from './fsTodos';

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

  test('deleteTodo — todo removed', async () => {
    await deleteTodo(todo.id, testRoot);
    const afterDelete = await listTodos(testRoot);
    expect(afterDelete).toHaveLength(0);
  });
});
