import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listTodos, createTodo } from "@/lib/fsTodos";
import { QUADRANT_KEYS } from "@/lib/types";

const QuadrantEnum = z.enum(QUADRANT_KEYS);

const CreateTodoSchema = z.object({
  title: z.string().min(1),
  quadrant: QuadrantEnum,
  description: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function GET() {
  try {
    const todos = await listTodos();
    return NextResponse.json(todos);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = CreateTodoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const todo = await createTodo(parsed.data);
    return NextResponse.json(todo, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
