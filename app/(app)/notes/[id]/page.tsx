import { getNote, listNotes } from '@/lib/fsNotes';
import { notFound } from 'next/navigation';
import { NoteEditor } from './NoteEditor';

function extractTags(notes: { tags: string[] }[]): string[] {
  const tagSet = new Set<string>();
  for (const n of notes) {
    for (const t of n.tags) {
      tagSet.add(t);
    }
  }
  return [...tagSet].sort();
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NoteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [note, allNotes] = await Promise.all([getNote(id), listNotes()]);

  if (!note) {
    notFound();
  }

  const allTags = extractTags(allNotes);
  const otherNotes = allNotes.filter((n) => n.id !== note.id);

  return <NoteEditor key={note.id} note={note} allTags={allTags} notes={otherNotes} />;
}
