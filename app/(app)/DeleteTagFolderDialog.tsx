'use client';

import { useMemo, useState } from 'react';
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
import { stripFolderTags } from '@/lib/offlineTagFolder';
import { getNotesUnderPath } from '@/lib/tagTree';
import { useData } from './DataProvider';

interface DeleteTagFolderDialogProps {
  path: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

function notesLabel(count: number): string {
  return count === 1 ? 'Notiz' : 'Notizen';
}

export function DeleteTagFolderDialog({ path, open, onOpenChange, onDeleted }: DeleteTagFolderDialogProps) {
  const { notes, deleteTagFolder } = useData();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { affectedCount, fullyDeletedCount, strippedCount } = useMemo(() => {
    if (!open) {
      return { affectedCount: 0, fullyDeletedCount: 0, strippedCount: 0 };
    }

    const affected = getNotesUnderPath(notes, path);
    let fullyDeleted = 0;
    for (const note of affected) {
      if (stripFolderTags(note.tags, path).length === 0) {
        fullyDeleted++;
      }
    }
    return {
      affectedCount: affected.length,
      fullyDeletedCount: fullyDeleted,
      strippedCount: affected.length - fullyDeleted,
    };
  }, [open, notes, path]);

  const isEmpty = affectedCount === 0;

  const handleDelete = () => {
    setError(null);
    setDeleting(true);
    void deleteTagFolder(path)
      .then(() => {
        onDeleted();
        onOpenChange(false);
      })
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Fehler beim Löschen des Ordners');
      })
      .finally(() => {
        setDeleting(false);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ordner löschen?</DialogTitle>
          <DialogDescription>
            {isEmpty ? (
              <>Der Ordner &raquo;{path}&laquo; enthält keine Notizen.</>
            ) : (
              <>
                Der Ordner &raquo;{path}&laquo; enthält {affectedCount} {notesLabel(affectedCount)}.{' '}
                {fullyDeletedCount > 0 && (
                  <>
                    {fullyDeletedCount} {notesLabel(fullyDeletedCount)}{' '}
                    {fullyDeletedCount === 1 ? 'wird' : 'werden'} vollständig gelöscht
                    {strippedCount > 0 ? ', ' : '.'}
                  </>
                )}
                {strippedCount > 0 && (
                  <>
                    {strippedCount} {notesLabel(strippedCount)}{' '}
                    {strippedCount === 1 ? 'behält' : 'behalten'} die übrigen Tags.
                  </>
                )}
              </>
            )}
            {error !== null && <div className="mt-2 text-sm text-destructive">{error}</div>}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || isEmpty}
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
