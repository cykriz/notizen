import { getNote } from '@/lib/fsNotes';
import { getUserDataDir } from '@/lib/auth';
import { NotePageClient } from './NotePageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NoteDetailPage({ params }: PageProps) {
  const { id } = await params;

  let note = null;

  try {
    const root = await getUserDataDir();
    note = await getNote(id, root);
  } catch {
    // Offline — NotePageClient will load from localStorage
  }

  return <NotePageClient note={note} noteId={id} />;
}
