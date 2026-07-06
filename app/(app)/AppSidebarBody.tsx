'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { SidebarContent } from '@/components/ui/sidebar';
import { SYNC_ENTITY } from '@/lib/constants';
import type { NoteSummary, Todo } from '@/lib/types';
import { NotesSidebarContent } from './NotesSidebarContent';
import { TodosSidebarContent } from './TodosSidebarContent';
import { TrashView } from './TrashView';
import { todosViewStore } from './todosViewStore';
import type { NoteSelection } from './useNoteSelection';
import type { SidebarView } from './viewStore';

interface AppSidebarBodyProps {
  isTodos: boolean;
  view: SidebarView;
  notes: NoteSummary[];
  todos: Todo[];
  currentTagPath: string;
  handleCreate: () => void;
  pending: boolean;
  selection: NoteSelection;
}

export function AppSidebarBody({
  isTodos,
  view,
  notes,
  todos,
  currentTagPath,
  handleCreate,
  pending,
  selection,
}: AppSidebarBodyProps) {
  const todosView = useSyncExternalStore(
    todosViewStore.subscribe,
    todosViewStore.getSnapshot,
    todosViewStore.getServerSnapshot,
  );

  let content: ReactNode;
  if (!isTodos) {
    content = (
      <NotesSidebarContent
        notes={notes}
        currentTagPath={currentTagPath}
        view={view}
        handleCreate={handleCreate}
        pending={pending}
        selection={selection}
      />
    );
  } else if (todosView === 'trash') {
    content = <TrashView kind={SYNC_ENTITY.TODO} />;
  } else {
    content = <TodosSidebarContent todos={todos} />;
  }

  return <SidebarContent>{content}</SidebarContent>;
}
