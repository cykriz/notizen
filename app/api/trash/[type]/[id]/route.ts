import { type NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth';
import { errorResponse, idempotentDelete } from '@/lib/apiHelpers';
import { SYNC_ENTITY } from '@/lib/constants';
import { permanentlyDeleteNote } from '@/lib/fsTrash';
import { permanentlyDeleteTodo } from '@/lib/fsTodos';
import { revokeShare } from '@/lib/fsShares';

interface RouteParams {
  params: Promise<{ type: string; id: string }>;
}

// DELETE: permanently remove a single trashed item.
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { root, username } = await getUserSession();
    const { type, id } = await params;
    if (type !== SYNC_ENTITY.NOTE && type !== SYNC_ENTITY.TODO) {
      return NextResponse.json({ error: 'Invalid trash item type' }, { status: 400 });
    }

    if (type === SYNC_ENTITY.NOTE) {
      const response = await idempotentDelete(() => permanentlyDeleteNote(id, root));
      if (response.status === 200) {
        await revokeShare(username, id).catch((e: unknown) => {
          console.error('revokeShare failed', e);
        });
      }

      return response;
    }

    return await idempotentDelete(() => permanentlyDeleteTodo(id, root));
  } catch (err) {
    return errorResponse(err);
  }
}
