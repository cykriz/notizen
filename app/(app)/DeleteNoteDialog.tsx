'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useData } from './DataProvider';

interface DeleteNoteDialogProps {
  noteId: string;
  noteTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteNoteDialog({ noteId, noteTitle, open, onOpenChange }: DeleteNoteDialogProps) {
  const { deleteNote } = useData();
  const router = useRouter();
  const pathname = usePathname();
  const [deleting, setDeleting] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              setDeleting(true);
              void deleteNote(noteId)
                .then(() => {
                  if (pathname !== '/notes') {
                    router.push('/notes');
                  }
                })
                .catch(console.error)
                .finally(() => {
                  setDeleting(false);
                });
            }}
            disabled={deleting}
            autoFocus
          >
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Endgültig löschen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
