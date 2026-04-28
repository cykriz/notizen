'use server';

import { z } from 'zod';
import { getNote, NotFoundError } from '@/lib/fsNotes';
import { requireAuthSession } from '@/lib/auth';
import { upsertShare, getShareByNote, revokeShare, type ShareRecord } from '@/lib/fsShares';
import { SharePresetSchema } from '@/lib/shareTypes';
import { DEFAULT_SHARE_EXPIRY, type ShareExpiryPreset } from '@/lib/constants';

const NoteIdSchema = z.uuid();

// Note: the share page declares `dynamic = 'force-dynamic'`, so revalidatePath
// is unnecessary here — the page rebuilds on every request.

export async function upsertShareLinkAction(
  noteId: string,
  preset: ShareExpiryPreset = DEFAULT_SHARE_EXPIRY,
): Promise<ShareRecord> {
  const validNoteId = NoteIdSchema.parse(noteId);
  const validPreset = SharePresetSchema.parse(preset);

  const { root, username } = await requireAuthSession();

  const note = await getNote(validNoteId, root);
  if (!note) {
    throw new NotFoundError('Notiz nicht gefunden');
  }

  return await upsertShare(username, validNoteId, validPreset);
}

export async function revokeShareLinkAction(noteId: string): Promise<void> {
  const validNoteId = NoteIdSchema.parse(noteId);

  const { username } = await requireAuthSession();

  await revokeShare(username, validNoteId);
}

export async function getShareInfoForNoteAction(noteId: string): Promise<ShareRecord | null> {
  const validNoteId = NoteIdSchema.parse(noteId);

  const { username } = await requireAuthSession();

  return await getShareByNote(username, validNoteId);
}
