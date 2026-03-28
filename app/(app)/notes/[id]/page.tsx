import { getNote, listNotes } from '@/lib/fsNotes';
import { NotePageClient } from './NotePageClient';

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

  let note = null;
  let allNotes: Awaited<ReturnType<typeof listNotes>> = [];
  let allTags: string[] = [];
  let otherNotes: Awaited<ReturnType<typeof listNotes>> = [];

  try {
    [note, allNotes] = await Promise.all([getNote(id), listNotes()]);
    allTags = extractTags(allNotes);
    otherNotes = allNotes.filter((n) => n.id !== id);
  } catch {
    // Offline — NotePageClient will load from localStorage
  }

  return (
    <NotePageClient
      note={note}
      allTags={allTags}
      otherNotes={otherNotes}
      noteId={id}
    />
  );
}
