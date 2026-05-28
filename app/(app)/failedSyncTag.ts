import { FAILED_SYNC_TAG } from '@/lib/constants';
import type { NoteSummary } from '@/lib/types';

// Render-time only — surfaces the synthetic FAILED_SYNC_TAG on notes whose
// sync has permanently failed. Not persisted to the cached list or the server,
// so the marker can never leak into a PUT payload.
//
// Pure function: callers compute `failedIds` from the failed sync queue and
// memoize against `failedSyncCount` (which is reactive). Keeps localStorage
// reads out of the render path.
export function withFailedSyncTag(notes: NoteSummary[], failedIds: Set<string>): NoteSummary[] {
  if (failedIds.size === 0) {
    return notes;
  }

  return notes.map((n) =>
    failedIds.has(n.id) && !n.tags.includes(FAILED_SYNC_TAG)
      ? { ...n, tags: [...n.tags, FAILED_SYNC_TAG] }
      : n,
  );
}
