import { listTodos } from '@/lib/fsTodos';
import { listNotes } from '@/lib/fsNotes';
import { EisenhowerMatrix } from './EisenhowerMatrix';

export default async function TodosPage() {
  const [todos, notes] = await Promise.all([listTodos(), listNotes()]);
  return <EisenhowerMatrix todos={todos} notes={notes} />;
}
