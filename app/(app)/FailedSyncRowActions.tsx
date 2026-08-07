'use client';

import { useState } from 'react';
import { Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CANCEL_LABEL } from '@/lib/constants';
import {
  FAILED_SYNC_DISCARD_CONFIRM_LABEL,
  FAILED_SYNC_DISCARD_LABEL,
  FAILED_SYNC_DISCARD_OFFLINE_HINT,
  FAILED_SYNC_DISCARD_QUESTION,
  FAILED_SYNC_PUSH_LABEL,
  FAILED_SYNC_PUSH_OFFLINE,
  FAILED_SYNC_PUSH_RUNNING,
} from '@/lib/failedSyncConstants';
import type { FailedSyncDetail } from '@/lib/failedSyncDetail';

interface FailedSyncRowActionsProps {
  detail: FailedSyncDetail;
  isOnline: boolean;
  onPush: (detail: FailedSyncDetail) => void;
  onDiscard: (detail: FailedSyncDetail) => void;
}

/**
 * The two directions a failed entry can be resolved in, on their own line.
 *
 * Spelled out rather than icon-only: which side wins — local or server — is the
 * decision the whole dialog exists to present, and it must never be a guess from
 * a glyph. They get a dedicated row because two text buttons beside the title
 * squeeze it to a few characters at the dialog's width.
 */
export function FailedSyncRowActions({ detail, isOnline, onPush, onDiscard }: FailedSyncRowActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const pushDisabled = detail.pushBlocked || !isOnline;

  function pushTitle(): string {
    if (detail.pushBlocked) {
      return FAILED_SYNC_PUSH_RUNNING;
    }

    return isOnline ? FAILED_SYNC_PUSH_LABEL : FAILED_SYNC_PUSH_OFFLINE;
  }

  // The confirm step replaces the whole bar, so the destructive button cannot be
  // hit by a click aimed at "Auf Server hochladen" next to it.
  if (confirming) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t pt-2">
        <span className="mr-auto text-xs text-destructive">{FAILED_SYNC_DISCARD_QUESTION}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setConfirming(false);
          }}
        >
          {CANCEL_LABEL}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          autoFocus
          onClick={() => {
            setConfirming(false);
            onDiscard(detail);
          }}
        >
          <Trash2 />
          {FAILED_SYNC_DISCARD_CONFIRM_LABEL}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t pt-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={pushDisabled}
        onClick={() => {
          onPush(detail);
        }}
        title={pushTitle()}
      >
        <UploadCloud />
        {FAILED_SYNC_PUSH_LABEL}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setConfirming(true);
        }}
        className="text-destructive hover:text-destructive"
        title={isOnline ? FAILED_SYNC_DISCARD_LABEL : `${FAILED_SYNC_DISCARD_LABEL} — ${FAILED_SYNC_DISCARD_OFFLINE_HINT}`}
      >
        <Trash2 />
        {FAILED_SYNC_DISCARD_LABEL}
      </Button>
    </div>
  );
}
