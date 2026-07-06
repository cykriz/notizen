'use server';

import { z } from 'zod';
import { getNote, listNotes, NotFoundError } from '@/lib/fsNotes';
import { requireAuthSession } from '@/lib/auth';
import { upsertShare, getShareByNote, revokeShare } from '@/lib/fsShares';
import { listSharesByUsername } from '@/lib/fsSharesQuery';
import { SharePresetSchema, type ShareRecord, type UserShareRecord } from '@/lib/shareTypes';
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

export async function listSharedNotesAction(): Promise<UserShareRecord[]> {
  const { root, username } = await requireAuthSession();
  const shares = await listSharesByUsername(username);
  // Hide shares whose note is currently in the trash: its share page resolves to
  // notFound(), so it must not appear as a live link here. The record is kept
  // (not revoked) until permanent delete, so it reappears on restore.
  const activeIds = new Set((await listNotes(root)).map((n) => n.id));
  return shares.filter((s) => activeIds.has(s.noteId));
}
