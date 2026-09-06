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

  test('updateTodo — stamps a server updatedAt that differs from the caller value', async () => {
    // Why the client MUST adopt the response: it stamps its own clock optimistically,
    // the server overwrites it here, and a cache still holding the client value makes
    // the next X-Expected-UpdatedAt a guaranteed 409.
    const t = await createTodo({ title: 'Stamp', quadrant: 'do' }, testRoot);
    const clientStamp = t.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    const updated = await updateTodo(t.id, { completed: true }, testRoot);

    expect(updated.updatedAt).not.toBe(clientStamp);
    await permanentlyDeleteTodo(t.id, testRoot).catch(() => undefined);
  });

  test('updateTodo — null removes the key entirely', async () => {
    // The contract foldQueuedEntry relies on: absent means "unchanged", null means
    // "clear". If null were merely stored, the merged outbox payload would be wrong.
    const t = await createTodo({ title: 'Nullen', quadrant: 'do', description: 'weg damit' }, testRoot);
    const updated = await updateTodo(t.id, { description: null }, testRoot);

    expect(updated.description).toBeUndefined();
    expect(Object.hasOwn(updated, 'description')).toBe(false);
  });

  test('readTodos — normalises a legacy delegate row and persists the fix', async () => {
    const legacyRoot = path.join(testRoot, 'legacy');
    await fs.mkdir(legacyRoot, { recursive: true });
    await fs.writeFile(
      path.join(legacyRoot, 'todos.json'),
      JSON.stringify([{
        id: 'alt-1',
        title: 'Vor cd9392c geschrieben',
        quadrant: 'delegate',
        completed: false,
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-01T08:00:00.000Z',
      }]),
      'utf-8',
    );

    // Read: the retired value is rewritten rather than served as-is.
    expect((await listTodos(legacyRoot))[0].quadrant).toBe('inbox');

    // Same rule as the client parser: anything unrecognised lands in Eingang, so
    // the server-rendered first paint and the cache agree and TodoBoard
    // can index its per-quadrant record directly.
    await fs.writeFile(
      path.join(legacyRoot, 'todos.json'),
      JSON.stringify([{
        id: 'fremd-1',
        title: 'Unbekannter Quadrant',
        quadrant: 'irgendwas',
        completed: false,
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-01T08:00:00.000Z',
      }]),
      'utf-8',
    );
    expect((await listTodos(legacyRoot))[0].quadrant).toBe('inbox');

    // Restore the delegate row for the write-through assertion below.
    await fs.writeFile(
      path.join(legacyRoot, 'todos.json'),
      JSON.stringify([{
        id: 'alt-1',
        title: 'Vor cd9392c geschrieben',
        quadrant: 'delegate',
        completed: false,
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-01T08:00:00.000Z',
      }]),
      'utf-8',
    );

    // Write: the next mutation flushes the fix to disk, so it self-heals.
    await updateTodo('alt-1', { completed: true }, legacyRoot);
    const onDisk: unknown = JSON.parse(await fs.readFile(path.join(legacyRoot, 'todos.json'), 'utf-8'));
    expect((onDisk as { quadrant: string }[])[0].quadrant).toBe('inbox');
  });

  test("readTodos — merges the retired 'schedule' and 'planned' columns into Eingang", async () => {
    const mergeRoot = path.join(testRoot, 'merge');
    await fs.mkdir(mergeRoot, { recursive: true });
    await fs.writeFile(
      path.join(mergeRoot, 'todos.json'),
      JSON.stringify(
        ['schedule', 'planned'].map((quadrant, i) => ({
          id: `alt-${String(i)}`,
          title: `Aus ${quadrant}`,
          quadrant,
          completed: false,
          createdAt: '2026-08-01T08:00:00.000Z',
          updatedAt: '2026-08-01T08:00:00.000Z',
        })),
      ),
      'utf-8',
    );

    // Terminable work belongs in the calendar, so neither column survives — but the
    // entries do, in the bucket the weekly ritual re-decides.
    expect((await listTodos(mergeRoot)).map((t) => t.quadrant)).toEqual(['inbox', 'inbox']);
  });

  test('readTodos — caps Erledigen at 3, newest kept, and persists the demotion', async () => {
    const overflowRoot = path.join(testRoot, 'overflow');
    await fs.mkdir(overflowRoot, { recursive: true });
    // Five open entries in 'do' is what the old four-quadrant board could leave behind.
    await fs.writeFile(
      path.join(overflowRoot, 'todos.json'),
      JSON.stringify(
        [1, 2, 3, 4, 5].map((n) => ({
          id: `d${String(n)}`,
          title: `Aufgabe ${String(n)}`,
          quadrant: 'do',
          completed: false,
          createdAt: '2026-08-01T08:00:00.000Z',
          updatedAt: `2026-08-0${String(n)}T08:00:00.000Z`,
        })),
      ),
      'utf-8',
    );

    const listed = await listTodos(overflowRoot);
    expect(listed.filter((t) => t.quadrant === 'do').map((t) => t.id).sort()).toEqual(['d3', 'd4', 'd5']);
    expect(listed.filter((t) => t.quadrant === 'inbox').map((t) => t.id).sort()).toEqual(['d1', 'd2']);

    // Same self-healing contract as the alias rescue: the next write makes it stick.
    await updateTodo('d5', { completed: true }, overflowRoot);
    const raw: unknown = JSON.parse(await fs.readFile(path.join(overflowRoot, 'todos.json'), 'utf-8'));
    const byId = new Map((raw as { id: string; quadrant: string }[]).map((t) => [t.id, t.quadrant]));
    expect(byId.get('d1')).toBe('inbox');
    expect(byId.get('d2')).toBe('inbox');
    expect(byId.get('d3')).toBe('do');
  });
});
