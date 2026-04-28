import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getNote, updateNote, deleteNote } from '@/lib/fsNotes';
import { getUserSession } from '@/lib/auth';
import { revokeShare } from '@/lib/fsShares';
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
    const { root, username } = await getUserSession();
    const { id } = await params;
    const response = await idempotentDelete(() => deleteNote(id, root));
    // 200 covers both success and idempotent-not-found; both are fine to
    // revoke for. Skip 5xx so a transient I/O error doesn't drop a still-
    // valid share.
    if (response.status === 200) {
      await revokeShare(username, id).catch((err: unknown) => {
        console.error('revokeShare failed', err);
      });
    }

    revalidatePath('/notes');
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
