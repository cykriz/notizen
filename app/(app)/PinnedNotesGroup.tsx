'use client';

import { useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Pin } from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { NoteListItem } from './NoteListItem';
import type { NoteSummary } from '@/lib/types';

interface PinnedNotesGroupProps {
  notes: NoteSummary[];
}

export function PinnedNotesGroup({ notes }: PinnedNotesGroupProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const pinnedNotes = useMemo(() => notes.filter((n) => n.pinned), [notes]);

  const onNavigate = useCallback(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);

  if (pinnedNotes.length === 0) {
    return null;
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>
          <Pin className="mr-1" /> Angepinnt
        </SidebarGroupLabel>
        <SidebarGroupContent className="max-h-[calc(0.4*var(--app-h))] overflow-y-auto">
          <SidebarMenu>
            {pinnedNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isActive={pathname === `/notes/${note.id}`}
                onNavigate={onNavigate}
                showDate={false}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarSeparator />
    </>
  );
}
