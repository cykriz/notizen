import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getTodo, updateTodo, deleteTodo } from '@/lib/fsTodos';
import { getUserDataDir } from '@/lib/auth';
import { QUADRANT_KEYS } from '@/lib/constants';
import { checkConflict, errorResponse, formatZodError, idempotentDelete } from '@/lib/apiHelpers';

const QuadrantEnum = z.enum(QUADRANT_KEYS);

const UpdateTodoSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  linkedNoteIds: z.array(z.string()).nullable().optional(),
  quadrant: QuadrantEnum.optional(),
  completed: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const root = await getUserDataDir();
    const { id } = await params;
    const todo = await getTodo(id, root);

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    return NextResponse.json(todo);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const root = await getUserDataDir();
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = UpdateTodoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const conflict = await checkConflict(request, () => getTodo(id, root));

    if (conflict) {
      return conflict;
    }

    const todo = await updateTodo(id, parsed.data, root);
    revalidatePath('/todos');
    return NextResponse.json(todo);
  } catch (err) {
    return errorResponse(err, { notFoundAs404: true });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const root = await getUserDataDir();
    const { id } = await params;
    const response = await idempotentDelete(() => deleteTodo(id, root));
    revalidatePath('/todos');
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
