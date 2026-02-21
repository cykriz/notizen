'use client';

import { useTransition, useSyncExternalStore } from 'react';
import { Save, Trash2, Loader2, Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
const emptySubscribe = () => noop;

interface NoteHeaderProps {
  noteId: string;
  title: string;
  onTitleChange: (title: string) => void;
  noteTitle: string;
  preview: 'edit' | 'preview';
  onTogglePreview: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  isDirty: boolean;
  onSavedReset: () => void;
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
}: NoteHeaderProps) {
  const [deleting, startDeleting] = useTransition();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <div className="flex items-center gap-2 bg-background shadow-[0_-28px_50px_40px_var(--header-shadow)] z-10">
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
        className="flex-1 text-2xl font-semibold h-14 border-none shadow-none focus-visible:ring-0 placeholder:text-2xl"
      />
      <Button
        onClick={onTogglePreview}
        size="sm"
        variant="ghost"
      >
        {preview === 'edit' ? <Eye /> : <Pencil />}
      </Button>
      <Button onClick={onSave} disabled={saving || (!isDirty && !saved)} size="sm" variant="ghost">
        {saving ? <Loader2 className="animate-spin" /> : <Save />}
        {saved ? 'Gespeichert!' : 'Speichern'}
      </Button>

      {mounted ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={deleting}>
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
              <Button variant="destructive" onClick={() => {
                startDeleting(async () => {
                  await deleteNoteAction(noteId); 
                }); 
              }} disabled={deleting}>
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Endgültig löschen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Button variant="ghost" size="sm" disabled>
          <Trash2 />
        </Button>
      )}
    </div>
  );
}
