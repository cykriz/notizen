'use server';

import { DEFAULT_NOTE_TITLE } from '@/lib/constants';
import { createNote, updateNote, deleteNote } from '@/lib/fsNotes';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createNoteAction() {
  const root = await requireAuth();
  const note = await createNote({ title: DEFAULT_NOTE_TITLE, content: '' }, root);
  revalidatePath('/notes');
  redirect(`/notes/${note.id}`);
}

export async function updateNoteAction(
  id: string,
  data: { title?: string; content?: string; tags?: string[]; pinned?: boolean },
) {
  const root = await requireAuth();
  const normalized = {
    ...data,
    title: data.title?.trim() === '' ? DEFAULT_NOTE_TITLE : data.title,
  };
  await updateNote(id, normalized, root);
  revalidatePath('/notes');
  revalidatePath(`/notes/${id}`);
}

export async function deleteNoteAction(id: string) {
  const root = await requireAuth();
  await deleteNote(id, root);
  revalidatePath('/notes');
  redirect('/notes');
}
