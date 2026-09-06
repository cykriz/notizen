import { type NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth';
import { errorResponse, invalidTrashTypeResponse, isTrashItemType } from '@/lib/apiHelpers';
import { SYNC_ENTITY } from '@/lib/constants';
import { emptyNotesTrash } from '@/lib/fsTrash';
import { emptyTodosTrash } from '@/lib/fsTodos';
import { revokeShare } from '@/lib/fsShares';

interface RouteParams {
  params: Promise<{ type: string }>;
}

// DELETE /api/trash/[type] — empty the trash for one kind (notes or todos).
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { root, username } = await getUserSession();
    const { type } = await params;
    if (!isTrashItemType(type)) {
      return invalidTrashTypeResponse();
    }

    if (type === SYNC_ENTITY.NOTE) {
      const removedNoteIds = await emptyNotesTrash(root);
      await Promise.all(
        removedNoteIds.map((id) =>
          revokeShare(username, id).catch((e: unknown) => {
            console.error('revokeShare failed', e);
          }),
        ),
      );
    } else {
      await emptyTodosTrash(root);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
