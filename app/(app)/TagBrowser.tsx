'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarMenu } from '@/components/ui/sidebar';
import { getNotesAtPath } from '@/lib/tagTree';
import { NoteListItem } from './NoteListItem';
import type { NoteSummary } from '@/lib/types';

interface TagNoteListProps {
  notes: NoteSummary[];
  currentPath: string;
  onNavigate: () => void;
}

export function TagNoteList({ notes, currentPath, onNavigate }: TagNoteListProps) {
  const pathname = usePathname();

  const notesAtLevel = useMemo(() => getNotesAtPath(notes, currentPath), [notes, currentPath]);
  const hasTagChildren = useMemo(() => {
    if (currentPath === '') {
      return notes.some((n) => n.tags.length > 0);
    }

    const prefix = `${currentPath}/`;
    return notes.some((n) => n.tags.some((t) => t.startsWith(prefix)));
  }, [notes, currentPath]);

  return (
    <>
      {notesAtLevel.length > 0 && (
        <SidebarMenu>
          {notesAtLevel.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isActive={pathname === `/notes/${note.id}`}
              onNavigate={onNavigate}
            />
          ))}
        </SidebarMenu>
      )}

      {!hasTagChildren && notesAtLevel.length === 0 && (
        <p className="px-4 py-4 text-xs text-muted-foreground text-center">Keine Notizen mit diesem Tag</p>
      )}
    </>
  );
}
