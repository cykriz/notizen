import { getNote } from "@/lib/fsNotes";
import { notFound } from "next/navigation";
import { NoteEditor } from "./NoteEditor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NoteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const note = await getNote(id);

  if (!note) {
    notFound();
  }

  return <NoteEditor key={note.id} note={note} />;
}
