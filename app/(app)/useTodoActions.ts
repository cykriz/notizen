'use client';

import { useCallback } from 'react';
import type { Todo } from '@/lib/types';
import {
  type CreateTodoInput,
  type UpdateTodoInput,
  createTodoOffline,
  deleteTodoOffline,
  updateTodoOffline,
} from '@/lib/offlineTodos';

interface UseTodoActionsArgs {
  todosRef: React.RefObject<Todo[]>;
  isOnlineRef: React.RefObject<boolean>;
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  syncPending: () => void;
}

/**
 * The three todo mutations, extracted from DataProvider to keep it under the
 * 200-line cap. Each writes through the offline layer (never a server action —
 * those bypass the outbox), then arms the sync loop via syncPending.
 */
export function useTodoActions({ todosRef, isOnlineRef, setTodos, syncPending }: UseTodoActionsArgs) {
  const createTodo = useCallback(async (input: CreateTodoInput): Promise<Todo> => {
    const { todo, updatedList } = await createTodoOffline(input, todosRef.current, isOnlineRef.current);
    setTodos(updatedList);
    syncPending();
    return todo;
  }, [todosRef, isOnlineRef, setTodos, syncPending]);

  const updateTodo = useCallback(async (id: string, input: UpdateTodoInput) => {
    setTodos(await updateTodoOffline(id, input, todosRef.current, isOnlineRef.current));
    syncPending();
  }, [todosRef, isOnlineRef, setTodos, syncPending]);

  const deleteTodo = useCallback(async (id: string) => {
    setTodos(await deleteTodoOffline(id, todosRef.current, isOnlineRef.current));
    syncPending();
  }, [todosRef, isOnlineRef, setTodos, syncPending]);

  return { createTodo, updateTodo, deleteTodo };
}
