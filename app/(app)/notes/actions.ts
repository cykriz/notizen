'use server';

import { DEFAULT_NOTE_TITLE } from '@/lib/constants';
import { createNote, updateNote, deleteNote } from '@/lib/fsNotes';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createNoteAction() {
  const note = await createNote({ title: DEFAULT_NOTE_TITLE, content: '' });
  revalidatePath('/notes');
  redirect(`/notes/${note.id}`);
}

export async function updateNoteAction(
  id: string,
  data: { title?: string; content?: string; tags?: string[]; pinned?: boolean },
) {
  const normalized = {
    ...data,
    title: data.title?.trim() === '' ? DEFAULT_NOTE_TITLE : data.title,
  };
  await updateNote(id, normalized);
  revalidatePath('/notes');
  revalidatePath(`/notes/${id}`);
}

export async function deleteNoteAction(id: string) {
  await deleteNote(id);
  revalidatePath('/notes');
  redirect('/notes');
}
