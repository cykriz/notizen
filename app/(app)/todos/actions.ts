"use server";

import { createTodo, updateTodo, deleteTodo, type TodoQuadrant } from "@/lib/fsTodos";
import { revalidatePath } from "next/cache";

interface CreateInput {
  title: string;
  quadrant: TodoQuadrant;
  description?: string;
  dueDate?: string;
}

export async function createTodoAction(input: CreateInput) {
  await createTodo(input);
  revalidatePath("/todos");
}

interface UpdateInput {
  title?: string;
  description?: string;
  dueDate?: string;
  quadrant?: TodoQuadrant;
  completed?: boolean;
}

export async function updateTodoAction(id: string, input: UpdateInput) {
  await updateTodo(id, input);
  revalidatePath("/todos");
}

export async function deleteTodoAction(id: string) {
  await deleteTodo(id);
  revalidatePath("/todos");
}

export async function toggleTodoAction(id: string, completed: boolean) {
  await updateTodo(id, { completed });
  revalidatePath("/todos");
}
