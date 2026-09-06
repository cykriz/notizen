'use client';

import { useData } from '@/app/(app)/dataContext';
import { TodoBoard } from './TodoBoard';

export default function TodosPage() {
  const { todos, notes } = useData();
  return <TodoBoard todos={todos} notes={notes} />;
}
