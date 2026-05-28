'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
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
import { useData } from './dataContext';

interface ClearFailedSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleared: () => void;
}

function entriesLabel(count: number): string {
  return count === 1 ? 'Eintrag' : 'Einträge';
}

export function ClearFailedSyncDialog({ open, onOpenChange, onCleared }: ClearFailedSyncDialogProps) {
  const { failedSyncCount, clearFailedSync } = useData();
  // Snapshot the count at open so the close animation doesn't render
  // `0 Einträge` after handleClear flips failedSyncCount.
  const [snapshot, setSnapshot] = useState(failedSyncCount);
  useEffect(() => {
    if (open) {
      setSnapshot(failedSyncCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally freeze on open
  }, [open]);

  const handleClear = () => {
    clearFailedSync();
    onCleared();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fehlgeschlagene Synchronisierungen löschen?</DialogTitle>
          <DialogDescription>
            {snapshot} {entriesLabel(snapshot)} werden endgültig verworfen.
            Lokale Änderungen, die nicht synchronisiert werden konnten, gehen dabei verloren.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleClear} disabled={snapshot === 0} autoFocus>
            <Trash2 />
            Endgültig löschen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
