'use client';

import { useTransition, useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Plus, FileText, Pin, Tags, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, useSidebar } from '@/components/ui/sidebar';
import { createNoteAction } from './notes/actions';
import { TagBrowser } from './TagBrowser';
import { NoteListItem } from './NoteListItem';
import type { NoteSummary } from '@/lib/types';

type SidebarView = 'tags' | 'all';
const STORAGE_KEY = 'notes-sidebar-view';

interface NotesSidebarContentProps {
  notes: NoteSummary[];
}

export function NotesSidebarContent({ notes }: NotesSidebarContentProps) {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [view, setView] = useState<SidebarView>(() => {
    if (typeof window === 'undefined') {
      return 'tags';
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'tags' || saved === 'all' ? saved : 'tags';
  });

  const toggleView = (v: SidebarView) => {
    setView(v);
    localStorage.setItem(STORAGE_KEY, v);
  };

  const handleCreate = () => {
    startTransition(async () => {
      await createNoteAction();
    });
  };

  const onNavigate = () => {
    setOpenMobile(false);
  };

  const pinnedNotes = useMemo(() => notes.filter((n) => n.pinned), [notes]);

  return (
    <>
      <div className="flex items-center gap-1 px-4 pt-2">
        <Button size="sm" variant="ghost" onClick={handleCreate} disabled={pending} className="flex-1 justify-start">
          <Plus />
          Neue Notiz
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => {
            toggleView('tags');
          }}
          className={cn({ 'bg-accent': view === 'tags' })}
        >
          <Tags />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => {
            toggleView('all');
          }}
          className={cn({ 'bg-accent': view === 'all' })}
        >
          <List />
        </Button>
      </div>

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
            {view === 'tags' && <TagBrowser notes={notes} />}
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
