'use client';

import { useTransition, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Paperclip, Pin, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge } from '@/components/ui/sidebar';
import { updateNoteAction, deleteNoteAction } from './notes/actions';
import type { NoteSummary } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
const emptySubscribe = () => noop;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

interface NoteListItemProps {
  note: NoteSummary;
  isActive: boolean;
  onNavigate: () => void;
}

export function NoteListItem({ note, isActive, onNavigate }: NoteListItemProps) {
  const [pinning, startPinning] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    startPinning(async () => {
      await updateNoteAction(note.id, { pinned: !note.pinned });
    });
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} className="h-auto py-2">
        <Link href={`/notes/${note.id}`} onClick={onNavigate}>
          <div className="flex flex-col gap-0.5 leading-tight">
            <span className="truncate font-medium">{note.title}</span>
            <span className="text-xs text-sidebar-foreground/60">{formatDate(note.updatedAt)}</span>
          </div>
        </Link>
      </SidebarMenuButton>

      {note.attachmentCount > 0 && (
        <SidebarMenuBadge className="md:group-hover/menu-item:hidden">
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
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleTogglePin}
          disabled={pinning}
          className={cn('h-5 w-5 [&>svg]:size-3', { 'bg-accent': note.pinned })}
        >
          {pinning ? <Loader2 className="animate-spin" /> : <Pin />}
        </Button>

        {mounted ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon-xs" disabled={deleting} className="h-5 w-5 [&>svg]:size-3">
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Notiz löschen?</DialogTitle>
                <DialogDescription>
                  &quot;{note.title}&quot; und alle Anhänge werden unwiderruflich gelöscht.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Abbrechen</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => {
                    startDeleting(async () => {
                      await deleteNoteAction(note.id);
                    });
                  }}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  Endgültig löschen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Button variant="ghost" size="icon-xs" disabled className="h-5 w-5 [&>svg]:size-3">
            <Trash2 />
          </Button>
        )}
      </div>
    </SidebarMenuItem>
  );
}
