import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserSession } from '@/lib/auth';
import { errorResponse, formatZodError } from '@/lib/apiHelpers';
import { getUserSettings, updateUserSettings } from '@/lib/fsUserSettings';
import { purgeExpiredTrash } from '@/lib/fsTrashPurge';
import { revokeShare } from '@/lib/fsShares';
import { MIN_TRASH_RETENTION_DAYS, MAX_TRASH_RETENTION_DAYS } from '@/lib/constants';

const UpdateSettingsSchema = z.object({
  retentionDays: z.number().int().min(MIN_TRASH_RETENTION_DAYS).max(MAX_TRASH_RETENTION_DAYS),
});

export async function GET() {
  try {
    const { root } = await getUserSession();
    return NextResponse.json(await getUserSettings(root));
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT: save the retention window, then apply it immediately (purge now-expired items).
export async function PUT(request: NextRequest) {
  try {
    const { root, username } = await getUserSession();
    const body: unknown = await request.json();
    const parsed = UpdateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const settings = await updateUserSettings(root, parsed.data);
    const { noteIds, todos } = await purgeExpiredTrash(root, settings.retentionDays);
    // Revoke shares of the notes the shortened window just permanently deleted.
    await Promise.all(
      noteIds.map((id) =>
        revokeShare(username, id).catch((e: unknown) => {
          console.error('revokeShare failed', e);
        }),
      ),
    );
    return NextResponse.json({ ...settings, purged: { notes: noteIds.length, todos } });
  } catch (err) {
    return errorResponse(err);
  }
}
