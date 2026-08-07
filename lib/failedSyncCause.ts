import {
  FAILED_SYNC_CAUSE_BY_STATUS,
  FAILED_SYNC_CAUSE_GAVE_UP,
  FAILED_SYNC_CAUSE_GONE,
  FAILED_SYNC_CAUSE_NOT_RECORDED,
  FAILED_SYNC_CAUSE_NO_INFO,
  FAILED_SYNC_CAUSE_SERVER,
  FAILED_SYNC_CAUSE_UNEXPECTED,
  FAILED_SYNC_HINT_GONE,
  FAILED_SYNC_HINT_NOT_RECORDED,
  FAILED_SYNC_HINT_RETRY,
  FAILED_SYNC_REASON_MAX_RETRIES,
  FAILED_SYNC_REASON_NON_RETRYABLE,
  FAILED_SYNC_STATUS_PREFIX,
} from './failedSyncConstants';
import type { SyncEntityType, SyncFailureInfo, SyncFailureReason } from './types';

export interface FailedSyncCause {
  // German one-sentence reason. Always non-empty.
  cause: string;
  // What the user can do about it, when there is something.
  hint: string | null;
  // 'HTTP-Status 404', or null when no response ever arrived.
  statusText: string | null;
  // Trimmed server response body, for diagnosis.
  detail: string | null;
}

function reasonText(reason: SyncFailureReason): string | null {
  switch (reason) {
    case 'max-retries': {
      return FAILED_SYNC_REASON_MAX_RETRIES;
    }

    case 'non-retryable': {
      return FAILED_SYNC_REASON_NON_RETRYABLE;
    }

    // Never displayed: 'server-error' only ever sits on a pending entry, and
    // 'not-recorded' carries its own hint.
    case 'server-error':
    case 'not-recorded': {
      return null;
    }
  }
}

function causeForStatus(status: number, entityType: SyncEntityType): { cause: string; hint: string | null } {
  if (status === 404) {
    return { cause: FAILED_SYNC_CAUSE_GONE[entityType], hint: FAILED_SYNC_HINT_GONE };
  }

  const known = FAILED_SYNC_CAUSE_BY_STATUS[status];
  if (known !== undefined) {
    return { cause: known, hint: null };
  }

  if (status >= 500) {
    return { cause: FAILED_SYNC_CAUSE_SERVER, hint: FAILED_SYNC_HINT_RETRY };
  }

  return { cause: FAILED_SYNC_CAUSE_UNEXPECTED, hint: null };
}

/**
 * Turns a recorded failure into German display text.
 *
 * The user-facing wording comes from the HTTP status only — never from the raw
 * server body, which is English and can leak internals. `undefined` is a normal
 * input: entries written before SyncFailureInfo existed carry no failure.
 */
export function describeFailureCause(
  failure: SyncFailureInfo | undefined,
  entityType: SyncEntityType,
): FailedSyncCause {
  if (failure === undefined) {
    return { cause: FAILED_SYNC_CAUSE_NO_INFO, hint: null, statusText: null, detail: null };
  }

  const detail = failure.message !== undefined && failure.message !== '' ? failure.message : null;
  const statusText =
    failure.status !== undefined ? `${FAILED_SYNC_STATUS_PREFIX} ${failure.status.toString()}` : null;

  if (failure.reason === 'not-recorded') {
    return { cause: FAILED_SYNC_CAUSE_NOT_RECORDED, hint: FAILED_SYNC_HINT_NOT_RECORDED, statusText, detail };
  }

  // No status means no server response ever arrived. For a max-retries give-up
  // that is a real, nameable outcome — reporting "cause not recorded" there would
  // wrongly suggest a stale entry from an older build.
  if (failure.status === undefined) {
    if (failure.reason === 'max-retries') {
      return { cause: FAILED_SYNC_CAUSE_GAVE_UP, hint: FAILED_SYNC_HINT_RETRY, statusText, detail };
    }

    return { cause: FAILED_SYNC_CAUSE_NO_INFO, hint: reasonText(failure.reason), statusText, detail };
  }

  const { cause, hint } = causeForStatus(failure.status, entityType);
  return { cause, hint: hint ?? reasonText(failure.reason), statusText, detail };
}
