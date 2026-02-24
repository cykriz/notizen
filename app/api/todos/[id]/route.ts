import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTodo, updateTodo, deleteTodo } from "@/lib/fsTodos";
import { QUADRANT_KEYS } from "@/lib/constants";

const QuadrantEnum = z.enum(QUADRANT_KEYS);

const UpdateTodoSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  linkedNoteIds: z.array(z.string()).optional(),
  quadrant: QuadrantEnum.optional(),
  completed: z.boolean().optional(),
});

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const todo = await getTodo(id);

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    return NextResponse.json(todo);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = UpdateTodoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const todo = await updateTodo(id, parsed.data);
    return NextResponse.json(todo);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteTodo(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
