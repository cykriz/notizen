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
import { CANCEL_LABEL, CREATE_LABEL, NEW_FOLDER_LABEL, pathHasReservedSegment } from '@/lib/constants';
import {
  FOLDER_NAME_PLACEHOLDER,
  FOLDER_PATH_HINT_PREFIX,
  FOLDER_RESERVED_HINT,
  FOLDER_ROOT_DESCRIPTION,
  folderParentDescription,
} from '@/lib/tagConstants';
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
            {parentPath !== '' ? folderParentDescription(parentPath) : FOLDER_ROOT_DESCRIPTION}
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
            placeholder={FOLDER_NAME_PLACEHOLDER}
            autoFocus
          />
          {normalized !== '' && (
            <p className="text-xs text-muted-foreground">
              {hasReservedSegment ? (
                <span className="text-destructive">{FOLDER_RESERVED_HINT}</span>
              ) : (
                <>
                  {FOLDER_PATH_HINT_PREFIX} <span className="font-mono">{fullPath}</span>
                </>
              )}
            </p>
          )}
        </div>
        <DialogFooter className="flex-row justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              {CANCEL_LABEL}
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {CREATE_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
