import { getNote, listAllTags, listNotes } from '@/lib/fsNotes';
import { notFound } from 'next/navigation';
import { NoteEditor } from './NoteEditor';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NoteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [note, allTags, allNotes] = await Promise.all([getNote(id), listAllTags(), listNotes()]);

  if (!note) {
    notFound();
  }

  const otherNotes = allNotes.filter((n) => n.id !== note.id);

  return <NoteEditor key={note.id} note={note} allTags={allTags} notes={otherNotes} />;
}
