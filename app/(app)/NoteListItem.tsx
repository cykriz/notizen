'use client';

import { memo, useTransition, useSyncExternalStore, useState } from 'react';
import Link from 'next/link';
import { Paperclip, Pin, Trash2, Loader2 } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge } from '@/components/ui/sidebar';
import { useData } from './dataContext';
import { DeleteNoteDialog } from './DeleteNoteDialog';
import type { NoteSummary } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
const emptySubscribe = () => noop;

interface NoteListItemProps {
  note: NoteSummary;
  isActive: boolean;
  onNavigate: () => void;
  showDate?: boolean;
}

export const NoteListItem = memo(function NoteListItem({
  note,
  isActive,
  onNavigate,
  showDate = true,
}: NoteListItemProps) {
  const { updateNote } = useData();
  const [pinning, startPinning] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    startPinning(async () => {
      try {
        await updateNote(note.id, { pinned: !note.pinned });
      } catch {
        // Network error — retried on the next sync
      }
    });
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} className="h-auto py-2 pr-18 md:pr-2">
        <Link href={`/notes/${note.id}`} onClick={onNavigate}>
          <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
            <span className="truncate font-medium">{note.title}</span>
            {showDate && <span className="text-xs text-sidebar-foreground/60">{formatDate(note.updatedAt)}</span>}
          </div>
        </Link>
      </SidebarMenuButton>

      {note.attachmentCount > 0 && (
        <SidebarMenuBadge className="hidden md:flex md:group-hover/menu-item:hidden">
          <Paperclip className="h-3 w-3" />
          {note.attachmentCount}
        </SidebarMenuBadge>
      )}

      <div
        className={cn(
          'absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5',
          'md:opacity-0 md:group-hover/menu-item:opacity-100 md:group-focus-within/menu-item:opacity-100',
          'transition-opacity',
        )}
      >
        {note.attachmentCount > 0 && (
          <span className="md:hidden flex items-center gap-0.5 text-xs text-sidebar-foreground/60 mr-0.5">
            <Paperclip className="h-3 w-3" />
            {note.attachmentCount}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleTogglePin}
          disabled={pinning}
          aria-label={note.pinned ? 'Notiz lösen' : 'Notiz anheften'}
          className={cn('h-5 w-5 [&>svg]:size-3', { 'bg-accent': note.pinned })}
        >
          {pinning ? <Loader2 className="animate-spin" /> : <Pin />}
        </Button>

        {mounted ? (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Notiz löschen"
              className="h-5 w-5 [&>svg]:size-3"
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              <Trash2 />
            </Button>
            <DeleteNoteDialog noteId={note.id} noteTitle={note.title} open={deleteOpen} onOpenChange={setDeleteOpen} />
          </>
        ) : (
          <Button variant="ghost" size="icon-xs" disabled aria-label="Notiz löschen" className="h-5 w-5 [&>svg]:size-3">
            <Trash2 />
          </Button>
        )}
      </div>
    </SidebarMenuItem>
  );
});
