'use client';

import { useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { NEW_FOLDER_LABEL, pathHasReservedSegment } from '@/lib/constants';
import { isCreatableTagPath, normalizeTagPath } from '@/lib/tagTree';

interface CreateTagFolderDialogProps {
  parentPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (folderName: string) => void;
}

export function CreateTagFolderDialog({ parentPath, open, onOpenChange, onCreate }: CreateTagFolderDialogProps) {
  const [name, setName] = useState('');

  const normalized = useMemo(() => normalizeTagPath(name), [name]);
  // Kept next to the shared predicate below, not folded into it: only this dialog has a place to
  // say *why* the name is rejected, and "reserved" is the one reason worth naming.
  const hasReservedSegment = useMemo(() => pathHasReservedSegment(normalized), [normalized]);
  const fullPath = parentPath !== '' ? `${parentPath}/${normalized}` : normalized;
  const canSubmit = isCreatableTagPath(normalized);

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    onCreate(normalized);
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setName('');
        }

        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{NEW_FOLDER_LABEL}</DialogTitle>
          <DialogDescription>
            {parentPath !== '' ? (
              <>Neuer Ordner unter &raquo;{parentPath}&laquo;. Eine erste Notiz wird darin angelegt.</>
            ) : (
              <>Neuer Ordner auf oberster Ebene. Eine erste Notiz wird darin angelegt.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ordnername…"
            autoFocus
          />
          {normalized !== '' && (
            <p className="text-xs text-muted-foreground">
              {hasReservedSegment ? (
                <span className="text-destructive">Dieser Name ist reserviert.</span>
              ) : (
                <>
                  Pfad: <span className="font-mono">{fullPath}</span>
                </>
              )}
            </p>
          )}
        </div>
        <DialogFooter className="flex-row justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Abbrechen
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            Erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
