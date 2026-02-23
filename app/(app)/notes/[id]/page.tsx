import { getNote, listAllTags } from "@/lib/fsNotes";
import { notFound } from "next/navigation";
import { NoteEditor } from "./NoteEditor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NoteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [note, allTags] = await Promise.all([getNote(id), listAllTags()]);

  if (!note) {
    notFound();
  }

  return <NoteEditor key={note.id} note={note} allTags={allTags} />;
}
