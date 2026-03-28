import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { listTodos, createTodo } from "@/lib/fsTodos";
import { QUADRANT_KEYS } from "@/lib/constants";
import { errorResponse, formatZodError } from "@/lib/apiHelpers";

const QuadrantEnum = z.enum(QUADRANT_KEYS);

const CreateTodoSchema = z.object({
  title: z.string().min(1),
  quadrant: QuadrantEnum,
  description: z.string().optional(),
  dueDate: z.string().optional(),
  linkedNoteIds: z.array(z.string()).optional(),
  id: z.uuid().optional(),
});

export async function GET() {
  try {
    const todos = await listTodos();
    return NextResponse.json(todos);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = CreateTodoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const todo = await createTodo(parsed.data);
    revalidatePath("/todos");
    return NextResponse.json(todo, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
