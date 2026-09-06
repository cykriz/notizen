import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getUserSession } from '@/lib/auth';
import { errorResponse, invalidTrashTypeResponse, isTrashItemType } from '@/lib/apiHelpers';
import { SYNC_ENTITY } from '@/lib/constants';
import { restoreNoteFromTrash } from '@/lib/fsTrash';
import { restoreTodo } from '@/lib/fsTodos';

interface RouteParams {
  params: Promise<{ type: string; id: string }>;
}

// POST: restore a single trashed item back to the active list.
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { root } = await getUserSession();
    const { type, id } = await params;
    if (!isTrashItemType(type)) {
      return invalidTrashTypeResponse();
    }

    if (type === SYNC_ENTITY.NOTE) {
      await restoreNoteFromTrash(id, root);
      revalidatePath('/notes');
    } else {
      await restoreTodo(id, root);
      revalidatePath('/todos');
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
