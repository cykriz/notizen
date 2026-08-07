'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { CANCEL_LABEL } from '@/lib/constants';
import {
  FAILED_SYNC_CLOSE_LABEL,
  FAILED_SYNC_DISCARD_ALL_CONFIRM,
  FAILED_SYNC_DISCARD_ALL_LABEL,
} from '@/lib/failedSyncConstants';

interface FailedSyncFooterProps {
  count: number;
  confirming: boolean;
  setConfirming: (confirming: boolean) => void;
  onClose: () => void;
  onDiscardAll: () => void;
}

/**
 * Two-step destructive footer, in place rather than a nested dialog: no stacked
 * Radix overlays, and it keeps the destructive path one deliberate extra click
 * away instead of being the default action the way the old dialog was.
 */
export function FailedSyncFooter({
  count,
  confirming,
  setConfirming,
  onClose,
  onDiscardAll,
}: FailedSyncFooterProps) {
  if (confirming) {
    return (
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => {
            setConfirming(false);
          }}
        >
          {CANCEL_LABEL}
        </Button>
        <Button
          variant="destructive"
          autoFocus
          onClick={() => {
            onDiscardAll();
            setConfirming(false);
          }}
        >
          <Trash2 />
          {FAILED_SYNC_DISCARD_ALL_CONFIRM}
        </Button>
      </DialogFooter>
    );
  }

  return (
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>
        {FAILED_SYNC_CLOSE_LABEL}
      </Button>
      <Button
        variant="destructive"
        disabled={count === 0}
        onClick={() => {
          setConfirming(true);
        }}
      >
        <Trash2 />
        {FAILED_SYNC_DISCARD_ALL_LABEL}
      </Button>
    </DialogFooter>
  );
}
