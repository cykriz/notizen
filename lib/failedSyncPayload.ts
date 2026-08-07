// Defensive readers for failed-queue data.
//
// getFailedSyncQueue() casts localStorage JSON straight to SyncQueueEntry[]
// without validating (deliberately — a Zod schema would DISCARD legacy entries,
// i.e. delete exactly the unsynced content we are trying to protect). So the
// types lie: `payload` is Record<string, unknown> by declaration, and `failure`
// is whatever some other build wrote. An object landing in JSX would crash the
// dialog on the very entry that needs rescuing.
import { QUADRANT_META } from './constants';
import {
  FAILED_SYNC_NO,
  FAILED_SYNC_TODO_COMPLETED,
  FAILED_SYNC_TODO_DUE,
  FAILED_SYNC_TODO_QUADRANT,
  FAILED_SYNC_YES,
} from './failedSyncConstants';
import type { SyncFailureInfo, SyncFailureReason, Todo } from './types';
import { formatDate } from './utils';

const FAILURE_REASONS: readonly string[] = ['server-error', 'max-retries', 'non-retryable', 'not-recorded'];

export function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

export function readStringArray(source: Record<string, unknown>, key: string): string[] | undefined {
  const value = source[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.every((v) => typeof v === 'string') ? (value) : undefined;
}

function readNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Narrows an unvalidated `failure` field to a safe SyncFailureInfo, or drops it. */
export function readFailure(raw: unknown): SyncFailureInfo | undefined {
  if (raw === null || typeof raw !== 'object') {
    return undefined;
  }

  const source = raw as Record<string, unknown>;
  const reason = readString(source, 'reason');
  if (reason === undefined || !FAILURE_REASONS.includes(reason)) {
    return undefined;
  }

  return {
    reason: reason as SyncFailureReason,
    status: readNumber(source, 'status'),
    message: readString(source, 'message'),
    failedAt: readString(source, 'failedAt') ?? '',
    attempts: readNumber(source, 'attempts') ?? 0,
  };
}

/**
 * Extra detail rows for a failed todo. Todos have no per-entity route (/todos is
 * a single matrix page), so "open" cannot show them — the inspector must carry
 * quadrant/due/completed inline instead.
 */
export function todoFields(
  payload: Record<string, unknown>,
  todo: Todo | undefined,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  const quadrant = readString(payload, 'quadrant') ?? todo?.quadrant;
  const meta = QUADRANT_META.find((q) => q.key === quadrant);
  if (meta !== undefined) {
    rows.push({ label: FAILED_SYNC_TODO_QUADRANT, value: meta.label });
  }

  const dueDate = readString(payload, 'dueDate') ?? todo?.dueDate;
  if (dueDate !== undefined && dueDate !== '') {
    rows.push({ label: FAILED_SYNC_TODO_DUE, value: formatDate(dueDate) });
  }

  const completedRaw = payload.completed;
  const completed = typeof completedRaw === 'boolean' ? completedRaw : todo?.completed;
  if (completed !== undefined) {
    rows.push({ label: FAILED_SYNC_TODO_COMPLETED, value: completed ? FAILED_SYNC_YES : FAILED_SYNC_NO });
  }

  return rows;
}
