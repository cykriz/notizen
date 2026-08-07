'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SYNC_ENTITY } from '@/lib/constants';
import {
  FAILED_SYNC_COPY_DONE,
  FAILED_SYNC_COPY_ERROR,
  FAILED_SYNC_DIALOG_DESCRIPTION,
  FAILED_SYNC_DIALOG_TITLE,
  FAILED_SYNC_EMPTY,
} from '@/lib/failedSyncConstants';
import { type FailedSyncDetail, buildClipboardText } from '@/lib/failedSyncDetail';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { FailedSyncNotice, pushNotice } from './FailedSyncNotice';
import { useData } from './dataContext';
import { FailedSyncFooter } from './FailedSyncFooter';
import { FailedSyncRow } from './FailedSyncRow';
import { useFailedSyncDetails } from './useFailedSyncDetails';
import { useReportedTransition } from './navigationLoading';

interface FailedSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Fires when the last entry is gone, so a caller sitting in the synthetic
  // sync-fehler folder can navigate out of it.
  onEmptied: () => void;
}

export function FailedSyncDialog({ open, onOpenChange, onEmptied }: FailedSyncDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const startNavigation = useReportedTransition();
  const { isOnline, pushFailedSync, discardFailedSync, discardAllFailedSync } = useData();
  const details = useFailedSyncDetails(open);
  const { copiedKey, copy, reset: resetCopied } = useCopyToClipboard();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);
    setNotice(null);
    setConfirmingAll(false);
    if (!open) {
      resetCopied();
    }
  }

  // Deliberately does NOT auto-close: staying open on FAILED_SYNC_EMPTY is
  // honest completion feedback, and it avoids the freeze-on-close snapshot the
  // old dialog needed to stop flashing a stale count during the animation.
  //
  // Fires only on the >0 -> 0 transition, via a ref rather than the callback
  // identity: callers pass an inline arrow, so depending on `onEmptied` would
  // re-run this on every render for as long as the list stays empty.
  const wasNonEmpty = useRef(false);
  const onEmptiedRef = useRef(onEmptied);
  useEffect(() => {
    onEmptiedRef.current = onEmptied;
  }, [onEmptied]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (details.length > 0) {
      wasNonEmpty.current = true;
    } else if (wasNonEmpty.current) {
      wasNonEmpty.current = false;
      onEmptiedRef.current();
    }
  }, [open, details.length]);

  const handleOpenEntity = useCallback(
    (detail: FailedSyncDetail) => {
      onOpenChange(false);
      startNavigation(() => {
        // Todos have no per-entity route (/todos is a single matrix page), which
        // is why the row carries their details inline.
        router.push(detail.entityType === SYNC_ENTITY.NOTE ? `/notes/${detail.entityId}` : '/todos');
      });
    },
    [onOpenChange, router, startNavigation],
  );

  const handlePush = useCallback(
    (detail: FailedSyncDetail) => {
      // The result matters: "hochladen" resolves four different ways (plain
      // replay, re-create, restore-then-replay, or nothing to send), and a
      // background drain can also resolve the entry between render and click.
      void pushFailedSync(detail.entityType, detail.entityId).then((result) => {
        setNotice(pushNotice(result));
      });
    },
    [pushFailedSync],
  );

  const handleCopy = useCallback(
    (detail: FailedSyncDetail) => {
      // The boolean matters: navigator.clipboard is undefined in non-secure
      // contexts (plain HTTP on a LAN/NAS), and copying is the escape hatch that
      // makes discarding defensible — it must not fail silently.
      void copy(detail.key, buildClipboardText(detail)).then((ok) => {
        setNotice(ok ? FAILED_SYNC_COPY_DONE : FAILED_SYNC_COPY_ERROR);
      });
    },
    [copy],
  );

  const handleDiscard = useCallback(
    (detail: FailedSyncDetail) => {
      discardFailedSync(detail.entityType, detail.entityId);
      setNotice(null);

      // Purging the cache is not enough while the note is OPEN: NoteEditor seeded
      // its state from the cache at mount, useAutoSave compares that against the
      // SSR prop so isDirty stays true, and the next keystroke pushes the very
      // text we just discarded to the server. Unmounting the editor is what
      // actually stops it — and showing a stand the user just deleted would be a
      // lie anyway. (Todos need none of this: /todos renders from context state,
      // which refreshFromServer already corrected.)
      //
      // A HARD navigation, not router.push: a client-side transition keeps the
      // editor's React state and its armed auto-save timer alive while it runs,
      // and either can rewrite notizen:note:<id> right back after the purge. A
      // document load is the only thing that deterministically tears both down.
      // The dialog closes with the page — an acceptable price for the guarantee
      // that discarded text cannot reach the server.
      if (detail.entityType === SYNC_ENTITY.NOTE && pathname === `/notes/${detail.entityId}`) {
        window.location.assign('/notes');
      }
    },
    [discardFailedSync, pathname],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{FAILED_SYNC_DIALOG_TITLE}</DialogTitle>
          <DialogDescription>{FAILED_SYNC_DIALOG_DESCRIPTION}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {details.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{FAILED_SYNC_EMPTY}</p>
          ) : (
            details.map((detail) => (
              <FailedSyncRow
                key={detail.key}
                detail={detail}
                isOnline={isOnline}
                isCopied={copiedKey === detail.key}
                soleEntry={details.length === 1}
                onOpen={handleOpenEntity}
                onPush={handlePush}
                onCopy={handleCopy}
                onDiscard={handleDiscard}
              />
            ))
          )}
        </div>

        <FailedSyncNotice confirmingAll={confirmingAll} count={details.length} notice={notice} />

        <FailedSyncFooter
          count={details.length}
          confirming={confirmingAll}
          setConfirming={setConfirmingAll}
          onClose={() => {
            onOpenChange(false);
          }}
          onDiscardAll={discardAllFailedSync}
        />
      </DialogContent>
    </Dialog>
  );
}
