import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getNote, updateNote } from '@/lib/fsNotes';
import { moveNoteToTrash } from '@/lib/fsTrash';
import { getUserSession } from '@/lib/auth';
import { checkConflict, errorResponse, formatZodError, idempotentDelete } from '@/lib/apiHelpers';

const UpdateNoteSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  pinned: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { root } = await getUserSession();
    const { id } = await params;
    const note = await getNote(id, root);

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { root } = await getUserSession();
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = UpdateNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const conflict = await checkConflict(request, () => getNote(id, root));

    if (conflict) {
      return conflict;
    }

    const note = await updateNote(id, parsed.data, root);
    revalidatePath('/notes');
    revalidatePath(`/notes/${id}`);
    return NextResponse.json(note);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { root } = await getUserSession();
    const { id } = await params;
    // Move to trash instead of hard-deleting. The share stays intact (a trashed
    // note resolves to null, so its share page shows a fallback); it is only
    // revoked on permanent delete / empty trash.
    const response = await idempotentDelete(() => moveNoteToTrash(id, root));
    revalidatePath('/notes');
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
