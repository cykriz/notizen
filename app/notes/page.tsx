import { listNotes } from "@/lib/fsNotes";
import { NotesList } from "./NotesList";

export default async function NotesPage() {
  const notes = await listNotes();
  return <NotesList notes={notes} />;
}
