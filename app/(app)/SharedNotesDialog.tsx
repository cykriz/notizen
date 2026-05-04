'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildShareUrl } from '@/lib/shareFormat';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useData } from './DataProvider';
import { sharedNotesStore } from './sharedNotesStore';
import { revokeShareLinkAction } from './shareActions';
import { SharedNotesList } from './SharedNotesList';

interface SharedNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SharedNotesDialog({ open, onOpenChange }: SharedNotesDialogProps) {
  const router = useRouter();
  const { notes } = useData();
  const shares = useSyncExternalStore(
    sharedNotesStore.subscribe,
    sharedNotesStore.getSnapshot,
    sharedNotesStore.getServerSnapshot,
  );
  const [error, setError] = useState<string | null>(null);
  const [revokingIds, setRevokingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [prevOpen, setPrevOpen] = useState(open);
  const { copiedKey: copiedToken, copy, reset: resetCopied } = useCopyToClipboard();

  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setError(null);
    } else {
      resetCopied();
    }
  }

  // Resync from server on open so external/expired changes show up.
  // Also refresh on tab-visibility return so a long-open dialog doesn't keep showing
  // shares that expired or were revoked from another window.
  useEffect(() => {
    if (!open) {
      return;
    }

    void sharedNotesStore.refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void sharedNotesStore.refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [open]);

  const handleOpen = useCallback(
    (noteId: string) => {
      onOpenChange(false);
      router.push(`/notes/${noteId}`);
    },
    [onOpenChange, router],
  );

  const handleCopy = useCallback(
    (token: string) => {
      setError(null);
      const url = buildShareUrl(window.location.origin, token);
      void copy(token, url).then((ok) => {
        if (!ok) {
          setError('Link konnte nicht kopiert werden.');
        }
      });
    },
    [copy],
  );

  const handleRevoke = useCallback((noteId: string) => {
    setRevokingIds((curr) => {
      const next = new Set(curr);
      next.add(noteId);
      return next;
    });
    setError(null);
    revokeShareLinkAction(noteId)
      .then(() => {
        sharedNotesStore.removeByNoteId(noteId);
      })
      .catch((err: unknown) => {
        console.error(err);
        setError('Widerruf fehlgeschlagen.');
      })
      .finally(() => {
        setRevokingIds((curr) => {
          if (!curr.has(noteId)) {
            return curr;
          }

          const next = new Set(curr);
          next.delete(noteId);
          return next;
        });
      });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Geteilte Notizen</DialogTitle>
          <DialogDescription>
            Übersicht aller aktiven Teilen-Links. Du kannst eine Notiz öffnen, ihren Link kopieren oder den Link widerrufen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          <SharedNotesList
            shares={shares}
            notes={notes}
            copiedToken={copiedToken}
            revokingIds={revokingIds}
            onCopy={handleCopy}
            onOpen={handleOpen}
            onRevoke={handleRevoke}
          />
        </div>

        <p className="min-h-4 text-xs text-destructive" aria-live="polite" role="status">
          {error ?? ''}
        </p>
      </DialogContent>
    </Dialog>
  );
}
