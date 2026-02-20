"use server";

import { createNote, updateNote, deleteNote } from "@/lib/fsNotes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createNoteAction() {
  const note = await createNote({ title: "Untitled", content: "" });
  revalidatePath("/notes");
  redirect(`/notes/${note.id}`);
}

export async function updateNoteAction(
  id: string,
  data: { title?: string; content?: string }
) {
  await updateNote(id, data);
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
}

export async function deleteNoteAction(id: string) {
  await deleteNote(id);
  revalidatePath("/notes");
  redirect("/notes");
}
