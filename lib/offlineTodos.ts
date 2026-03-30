import type { Todo, TodoQuadrant } from "@/lib/types";
import { setCachedTodos } from "@/lib/localCache";
import { addTombstone } from "@/lib/localCacheMerge";
import { SYNC_ACTION, SYNC_ENTITY } from "@/lib/constants";
import { enqueueMutation, hasPendingForEntity, hasPendingCreate, clearPendingForEntity } from "@/lib/syncQueue";
import { tryFetch } from "@/lib/tryFetch";
import { TodoResponseSchema } from "@/lib/schemas";

export interface CreateTodoInput {
  title: string;
  quadrant: TodoQuadrant;
  description?: string;
  dueDate?: string;
  linkedNoteIds?: string[];
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
  const entry = { entityType: SYNC_ENTITY.TODO, entityId: id, action: SYNC_ACTION.CREATE, payload, timestamp: now };

  // Direct API if online + no pending queue work; else enqueue for FIFO replay
  if (isOnline && !hasPendingForEntity(id)) {
    const res = await tryFetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res === null) {
      enqueueMutation(entry);
    } else if (!res.ok) {
      console.error(`createTodoOffline: server returned ${res.status.toString()}`);
    } else {
      const serverTodo = TodoResponseSchema.parse(await res.json());
      const serverList = updatedList.map((t) => t.id === id ? serverTodo : t);
      setCachedTodos(serverList);
      return { todo: serverTodo, updatedList: serverList };
    }
  } else {
    enqueueMutation(entry);
  }

  return { todo, updatedList };
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
  const entry = { entityType: SYNC_ENTITY.TODO, entityId: id, action: SYNC_ACTION.UPDATE, payload, timestamp: now };

  // Skip direct API if queue has pending mutations for this entity (preserves ordering)
  if (isOnline && !hasPendingForEntity(id)) {
    const expectedUpdatedAt = currentTodos.find((t) => t.id === id)?.updatedAt;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (expectedUpdatedAt !== undefined) {
      headers["X-Expected-UpdatedAt"] = expectedUpdatedAt;
    }

    const res = await tryFetch(`/api/todos/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    if (res === null) {
      enqueueMutation(entry);
    }
  } else {
    enqueueMutation(entry);
  }

  return updatedList;
}

export async function deleteTodoOffline(
  id: string,
  currentTodos: Todo[],
  isOnline: boolean,
): Promise<Todo[]> {
  const now = new Date().toISOString();
  const updatedList = currentTodos.filter((t) => t.id !== id);
  setCachedTodos(updatedList);
  addTombstone(id);

  if (hasPendingCreate(id)) {
    clearPendingForEntity(id);
    return updatedList;
  }

  const entry = { entityType: SYNC_ENTITY.TODO, entityId: id, action: SYNC_ACTION.DELETE, payload: {}, timestamp: now };

  if (isOnline && !hasPendingForEntity(id)) {
    const res = await tryFetch(`/api/todos/${id}`, { method: "DELETE" });
    if (res === null) {
      enqueueMutation(entry);
    }
  } else {
    enqueueMutation(entry);
  }

  return updatedList;
}
