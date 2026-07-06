'use client';

import { useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarGroup, SidebarGroupContent, SidebarMenu, useSidebar } from '@/components/ui/sidebar';
import { SYNC_ENTITY } from '@/lib/constants';
import { TagNoteList } from './TagBrowser';
import { NoteListItem } from './NoteListItem';
import { TrashView } from './TrashView';
import type { NoteSelection } from './useNoteSelection';
import type { SidebarView } from './viewStore';
import type { NoteSummary } from '@/lib/types';

interface NotesSidebarContentProps {
  notes: NoteSummary[];
  currentTagPath: string;
  view: SidebarView;
  handleCreate: () => void;
  pending: boolean;
  selection: NoteSelection;
}

export function NotesSidebarContent({ notes, currentTagPath, view, handleCreate, pending, selection }: NotesSidebarContentProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const onNavigate = useCallback(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);

  if (view === 'trash') {
    return <TrashView kind={SYNC_ENTITY.NOTE} />;
  }

  return (
    <>
      {notes.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p className="text-sm">Noch keine Notizen</p>
          <Button onClick={handleCreate} disabled={pending} variant="secondary" size="sm">
            <Plus /> Erste Notiz erstellen
          </Button>
        </div>
      )}

      {notes.length > 0 && (
        <SidebarGroup>
          <SidebarGroupContent>
            {view === 'tags' && (
              <TagNoteList notes={notes} currentPath={currentTagPath} onNavigate={onNavigate} selection={selection} />
            )}
            {view === 'all' && (
              <SidebarMenu>
                {notes.map((note) => (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    isActive={pathname === `/notes/${note.id}`}
                    onNavigate={onNavigate}
                    selection={selection}
                  />
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}
