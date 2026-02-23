'use client';

import { useTransition, useSyncExternalStore } from 'react';
import { Save, Trash2, Loader2, Eye, Pencil, List, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { deleteNoteAction } from '../actions';
import { PREVIEW_EDIT } from '@/lib/constants';
import type { PreviewMode } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
const emptySubscribe = () => noop;

interface NoteHeaderProps {
  noteId: string;
  title: string;
  onTitleChange: (title: string) => void;
  noteTitle: string;
  preview: PreviewMode;
  onTogglePreview: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  isDirty: boolean;
  onSavedReset: () => void;
  outlineVisible: boolean;
  onToggleOutline: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  children?: React.ReactNode;
}

export function NoteHeader({
  noteId,
  title,
  onTitleChange,
  noteTitle,
  preview,
  onTogglePreview,
  onSave,
  saving,
  saved,
  isDirty,
  onSavedReset,
  outlineVisible,
  onToggleOutline,
  pinned,
  onTogglePin,
  children,
}: NoteHeaderProps) {
  const [deleting, startDeleting] = useTransition();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <Card className="shrink-0 gap-0 py-0 shadow-panel z-10 mx-2 mt-2">
      <CardContent className="flex items-center gap-3 px-4 py-3">
        <Input
          id="note-title"
          name="note-title"
          value={title}
          onChange={(e) => {
            onTitleChange(e.target.value);
            onSavedReset();
          }}
          placeholder="Notiz-Titel…"
          rounded={false}
          className="flex-1 text-2xl font-semibold h-auto border-none shadow-none focus-visible:ring-0 placeholder:text-2xl px-0 bg-transparent"
        />
        <div className="flex shrink-0 items-center gap-1">
          <Button onClick={onTogglePin} size="icon-xs" variant="ghost" className={cn({ 'bg-accent': pinned })}>
            <Pin />
          </Button>
          <Button
            onClick={onToggleOutline}
            size="icon-xs"
            variant="ghost"
            className={cn('hidden md:inline-flex', { 'bg-accent': outlineVisible })}
          >
            <List />
          </Button>
          <Button onClick={onTogglePreview} size="icon-xs" variant="ghost">
            {preview === PREVIEW_EDIT ? <Eye /> : <Pencil />}
          </Button>
          <Button onClick={onSave} disabled={saving || (!isDirty && !saved)} size="icon-xs" variant="ghost">
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
          </Button>
          {mounted ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon-xs" disabled={deleting}>
                  {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Notiz löschen?</DialogTitle>
                  <DialogDescription>
                    &quot;{noteTitle}&quot; und alle Anhänge werden unwiderruflich gelöscht.
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
                        await deleteNoteAction(noteId);
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
            <Button variant="ghost" size="icon-xs" disabled>
              <Trash2 />
            </Button>
          )}
        </div>
      </CardContent>
      {children}
    </Card>
  );
}
