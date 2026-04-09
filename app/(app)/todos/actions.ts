'use server';

import { createTodo, updateTodo, deleteTodo, type TodoQuadrant } from '@/lib/fsTodos';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

interface CreateInput {
  title: string;
  quadrant: TodoQuadrant;
  description?: string;
  dueDate?: string;
  linkedNoteIds?: string[];
}

export async function createTodoAction(input: CreateInput) {
  const root = await requireAuth();
  await createTodo(input, root);
  revalidatePath('/todos');
}

interface UpdateInput {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  linkedNoteIds?: string[] | null;
  quadrant?: TodoQuadrant;
  completed?: boolean;
}

export async function updateTodoAction(id: string, input: UpdateInput) {
  const root = await requireAuth();
  await updateTodo(id, input, root);
  revalidatePath('/todos');
}

export async function deleteTodoAction(id: string) {
  const root = await requireAuth();
  await deleteTodo(id, root);
  revalidatePath('/todos');
}

export async function toggleTodoAction(id: string, completed: boolean) {
  const root = await requireAuth();
  await updateTodo(id, { completed }, root);
  revalidatePath('/todos');
}
