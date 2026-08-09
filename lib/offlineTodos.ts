import type { Todo, TodoQuadrant } from '@/lib/types';
import { getCachedTodos, setCachedTodos } from '@/lib/localCache';
import { SYNC_ACTION, SYNC_ENTITY } from '@/lib/constants';
import { deleteEntityOffline, sendOrQueue } from '@/lib/offlineWrite';
import { upsertById } from '@/lib/offlineAdopt';
import { TodoResponseSchema, reportUnreadableResponse } from '@/lib/schemas';

export interface CreateTodoInput {
  title: string;
  quadrant: TodoQuadrant;
  description?: string;
  dueDate?: string;
  linkedNoteIds?: string[];
}

/**
 * Writes the server's own row over the optimistic one — see upsertById for why
 * this matters and why it reads the current cache. Returns the parsed row
 * alongside the list so callers never re-parse what was resolved here.
 */
function adoptServerTodo(body: unknown, fallback: Todo[]): { entity: Todo | null; list: Todo[] } {
  const parsed = TodoResponseSchema.safeParse(body);
  if (!parsed.success) {
    // The write succeeded but we cannot read the answer — a client/server schema
    // drift. Self-correcting (the stale updatedAt takes the 409 re-send path on
    // the next edit), but silence would hide a real deployment mismatch.
    reportUnreadableResponse('adoptServerTodo', body);
    return { entity: null, list: fallback };
  }

  const merged = upsertById(getCachedTodos(), parsed.data, 'end');
  setCachedTodos(merged);
  return { entity: parsed.data, list: merged };
}

export async function createTodoOffline(
  input: CreateTodoInput,
  currentTodos: Todo[],
  isOnline: boolean,
): Promise<{ todo: Todo; updatedList: Todo[] }> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const todo: Todo = {
    id, title: input.title, quadrant: input.quadrant,
    description: input.description, dueDate: input.dueDate,
    linkedNoteIds: input.linkedNoteIds, completed: false,
    createdAt: now, updatedAt: now,
  };

  const updatedList = [...currentTodos, todo];
  setCachedTodos(updatedList);

  const payload = { id, ...input };
  const result = await sendOrQueue(
    { entityType: SYNC_ENTITY.TODO, entityId: id, action: SYNC_ACTION.CREATE, payload, timestamp: now },
    { url: '/api/todos', method: 'POST', body: payload },
    isOnline,
  );

  if (result.outcome !== 'ok') {
    return { todo, updatedList };
  }

  const { entity, list } = adoptServerTodo(result.body, updatedList);
  return { todo: entity ?? todo, updatedList: list };
}

export interface UpdateTodoInput {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  linkedNoteIds?: string[] | null;
  quadrant?: TodoQuadrant;
  completed?: boolean;
}

export async function updateTodoOffline(
  id: string,
  input: UpdateTodoInput,
  currentTodos: Todo[],
  isOnline: boolean,
): Promise<Todo[]> {
  const now = new Date().toISOString();

  const updatedList = currentTodos.map((t) => {
    if (t.id !== id) {
      return t;
    }

    return {
      ...t,
      ...input,
      description: input.description === null ? undefined : (input.description ?? t.description),
      dueDate: input.dueDate === null ? undefined : (input.dueDate ?? t.dueDate),
      linkedNoteIds: input.linkedNoteIds === null ? undefined : (input.linkedNoteIds ?? t.linkedNoteIds),
      updatedAt: now,
    };
  });
  setCachedTodos(updatedList);

  const payload = { ...input };
  const result = await sendOrQueue(
    { entityType: SYNC_ENTITY.TODO, entityId: id, action: SYNC_ACTION.UPDATE, payload, timestamp: now },
    {
      url: `/api/todos/${id}`,
      method: 'PUT',
      body: payload,
      expectedUpdatedAt: currentTodos.find((t) => t.id === id)?.updatedAt,
    },
    isOnline,
  );

  return result.outcome === 'ok' ? adoptServerTodo(result.body, updatedList).list : updatedList;
}

export function deleteTodoOffline(
  id: string,
  currentTodos: Todo[],
  isOnline: boolean,
): Promise<Todo[]> {
  return deleteEntityOffline(id, currentTodos, isOnline, {
    entityType: SYNC_ENTITY.TODO,
    baseUrl: '/api/todos',
    writeCache: setCachedTodos,
  });
}
