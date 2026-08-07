'use client';

import {
  FAILED_SYNC_DISCARD_ALL_WARNING,
  FAILED_SYNC_PUSH_ERROR,
  FAILED_SYNC_PUSH_NOTHING,
  FAILED_SYNC_PUSH_OFFLINE,
  FAILED_SYNC_PUSH_QUEUED,
  FAILED_SYNC_PUSH_RECREATED,
  FAILED_SYNC_PUSH_RESTORED,
  FAILED_SYNC_PUSH_SKIPPED,
  FAILED_SYNC_PUSH_UNDECIDABLE,
  failedSyncDiscardAllQuestion,
} from '@/lib/failedSyncConstants';
import { cn } from '@/lib/utils';
import type { PushResult } from '@/hooks/useFailedSyncActions';

const PUSH_NOTICE: Record<PushResult, string> = {
  queued: FAILED_SYNC_PUSH_QUEUED,
  recreated: FAILED_SYNC_PUSH_RECREATED,
  restored: FAILED_SYNC_PUSH_RESTORED,
  offline: FAILED_SYNC_PUSH_OFFLINE,
  undecidable: FAILED_SYNC_PUSH_UNDECIDABLE,
  'nothing-to-push': FAILED_SYNC_PUSH_NOTHING,
  skipped: FAILED_SYNC_PUSH_SKIPPED,
  error: FAILED_SYNC_PUSH_ERROR,
};

/** "Auf Server hochladen" resolves eight different ways; each one gets its own text. */
export function pushNotice(result: PushResult): string {
  return PUSH_NOTICE[result];
}

interface FailedSyncNoticeProps {
  confirmingAll: boolean;
  count: number;
  notice: string | null;
}

/**
 * The dialog's single live region. While the discard-all confirmation is armed it
 * takes over the line, so the warning cannot be scrolled past or missed.
 */
export function FailedSyncNotice({ confirmingAll, count, notice }: FailedSyncNoticeProps) {
  return (
    <p
      className={cn('min-h-4 text-xs', {
        'text-destructive': confirmingAll,
        'text-muted-foreground': !confirmingAll,
      })}
      aria-live="polite"
      role="status"
    >
      {confirmingAll
        ? `${failedSyncDiscardAllQuestion(count)} ${FAILED_SYNC_DISCARD_ALL_WARNING}`
        : (notice ?? '')}
    </p>
  );
}
