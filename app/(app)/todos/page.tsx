'use client';

import { useData } from '@/app/(app)/dataContext';
import { EisenhowerMatrix } from './EisenhowerMatrix';

export default function TodosPage() {
  const { todos, notes } = useData();
  return <EisenhowerMatrix todos={todos} notes={notes} />;
}
