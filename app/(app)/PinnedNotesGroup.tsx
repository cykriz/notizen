'use client';

import { useCallback } from 'react';
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
  // Already filtered by AppSidebar — see the separator rationale there.
  notes: NoteSummary[];
  // Off when the block below draws its own upper boundary.
  separator: boolean;
}

export function PinnedNotesGroup({ notes, separator }: PinnedNotesGroupProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const onNavigate = useCallback(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>
          <Pin className="mr-1" /> Angepinnt
        </SidebarGroupLabel>
        <SidebarGroupContent className="max-h-[calc(0.4*var(--app-h))] overflow-y-auto">
          <SidebarMenu>
            {notes.map((note) => (
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
      {separator && <SidebarSeparator />}
    </>
  );
}
