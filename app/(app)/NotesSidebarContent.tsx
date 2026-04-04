'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Plus, FileText, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, useSidebar } from '@/components/ui/sidebar';
import { TagNoteList } from './TagBrowser';
import { NoteListItem } from './NoteListItem';
import type { SidebarView } from './viewStore';
import type { NoteSummary } from '@/lib/types';

interface NotesSidebarContentProps {
  notes: NoteSummary[];
  currentTagPath: string;
  view: SidebarView;
  handleCreate: () => void;
  pending: boolean;
}

export function NotesSidebarContent({ notes, currentTagPath, view, handleCreate, pending }: NotesSidebarContentProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const onNavigate = () => {
    setOpenMobile(false);
  };

  const pinnedNotes = useMemo(() => notes.filter((n) => n.pinned), [notes]);

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

      {pinnedNotes.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>
            <Pin className="mr-1" /> Angepinnt
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pinnedNotes.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  isActive={pathname === `/notes/${note.id}`}
                  onNavigate={onNavigate}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {pinnedNotes.length > 0 && <Separator className="mx-4" />}

      {notes.length > 0 && (
        <SidebarGroup>
          <SidebarGroupContent>
            {view === 'tags' && <TagNoteList notes={notes} currentPath={currentTagPath} onNavigate={onNavigate} />}
            {view === 'all' && (
              <SidebarMenu>
                {notes.map((note) => (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    isActive={pathname === `/notes/${note.id}`}
                    onNavigate={onNavigate}
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
