import { NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth';
import { errorResponse } from '@/lib/apiHelpers';
import { getUserSettings } from '@/lib/fsUserSettings';
import { listTrashedNotes } from '@/lib/fsTrash';
import { purgeExpiredTrash } from '@/lib/fsTrashPurge';
import { listTrashedTodos } from '@/lib/fsTodos';
import { revokeShare } from '@/lib/fsShares';

// GET: auto-purge expired items with the current retention, then list what remains.
// Returns both kinds; each sidebar renders only its own (notes vs todos).
export async function GET() {
  try {
    const { root, username } = await getUserSession();
    const { retentionDays } = await getUserSettings(root);
    // Auto-purge permanently deletes note dirs → revoke their shares too (matches
    // the manual empty/permanent-delete paths). revokeShare is a no-op for unshared
    // notes, and noteIds is empty on a purge that removed nothing.
    const { noteIds } = await purgeExpiredTrash(root, retentionDays);
    await Promise.all(
      noteIds.map((id) =>
        revokeShare(username, id).catch((e: unknown) => {
          console.error('revokeShare failed', e);
        }),
      ),
    );
    const [notes, todos] = await Promise.all([listTrashedNotes(root), listTrashedTodos(root)]);
    return NextResponse.json({ retentionDays, notes, todos });
  } catch (err) {
    return errorResponse(err);
  }
}
