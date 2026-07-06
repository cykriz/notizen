'use client';

import { useState } from 'react';
import { RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SidebarMenuItem } from '@/components/ui/sidebar';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CANCEL_LABEL, TRASH_DELETE_PERMANENT_LABEL, TRASH_RESTORE_LABEL } from '@/lib/constants';

interface TrashItemRowProps {
  title: string;
  trashedAt: string;
  onRestore: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TrashItemRow({ title, trashedAt, onRestore, onDelete }: TrashItemRowProps) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    void fn()
      .catch(console.error)
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <SidebarMenuItem className="flex items-center gap-1 px-2 py-1.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="text-xs text-sidebar-foreground/60">Gelöscht am {formatDate(trashedAt)}</span>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={TRASH_RESTORE_LABEL}
        title={TRASH_RESTORE_LABEL}
        disabled={busy}
        onClick={() => {
          run(onRestore);
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={TRASH_DELETE_PERMANENT_LABEL}
        title={TRASH_DELETE_PERMANENT_LABEL}
        disabled={busy}
        onClick={() => {
          setConfirmOpen(true);
        }}
      >
        <Trash2 />
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TRASH_DELETE_PERMANENT_LABEL}?</DialogTitle>
            <DialogDescription>
              &quot;{title}&quot; wird unwiderruflich gelöscht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{CANCEL_LABEL}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              autoFocus
              onClick={() => {
                setConfirmOpen(false);
                run(onDelete);
              }}
            >
              <Trash2 /> {TRASH_DELETE_PERMANENT_LABEL}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenuItem>
  );
}
