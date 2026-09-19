import type { NoteSummary } from '@/lib/types';
import { NoteResponseSchema, reportUnreadableResponse } from '@/lib/schemas';
import { getCachedNote, getDraft, setCachedNote } from '@/lib/localCache';
import { pendingEntityIds } from '@/lib/localCacheMerge';
import { readJson } from '@/lib/offlineWrite';

/**
 * Pulls note BODIES, which the list pull cannot carry.
 *
 * /api/notes answers NoteSummary — no `content` — so refreshFromServer alone
 * could never make a note edited on another device current. The body lives in
 * `notizen:note:<id>` and used to be written only when the detail page was
 * opened, which is why the manual sync button left every open note stale.
 */

/** Requests in flight at once. Bounded because a sync must not fan out over a whole notebook. */
const CONCURRENCY = 4;

/** Returns the parsed JSON body, or null when the note could not be fetched. */
export type NoteBodyFetcher = (id: string) => Promise<unknown>;

/**
 * The production fetcher. Injected rather than called directly from
 * pullStaleNoteBodies so the pull logic stays testable without a DOM.
 */
export async function fetchNoteBody(id: string): Promise<unknown> {
  const res = await fetch(`/api/notes/${id}`);
  // readJson, not res.json(): a non-JSON 200 must not reject the whole sync.
  return res.ok ? await readJson(res) : null;
}

/**
 * Which cached bodies the server has a newer version of.
 *
 * Three exclusions, all of them "local wins", the same rule mergeById applies to
 * the lists:
 * - a note with no cached body was never opened, so there is nothing stale to
 *   replace; it is fetched on first open as before. Warming them all would mean
 *   one request per note on every sync.
 * - a note with a queued or failed mutation carries unsent content.
 * - a note with a draft carries unsaved keystrokes, and useNoteInitialState
 *   would prefer that draft over anything pulled here anyway.
 */
export function staleNoteBodyIds(summaries: NoteSummary[]): string[] {
  const locallyOwned = pendingEntityIds();

  const stale: string[] = [];
  for (const summary of summaries) {
    if (locallyOwned.has(summary.id) || getDraft(summary.id) !== null) {
      continue;
    }

    const cached = getCachedNote(summary.id);
    if (cached === null) {
      continue;
    }

    if (new Date(summary.updatedAt).getTime() > new Date(cached.updatedAt).getTime()) {
      stale.push(summary.id);
    }
  }

  return stale;
}

/**
 * Fetches one body and caches it. Returns whether the cache was actually replaced.
 *
 * Parses with the same schema and the same unreadable-response guard as
 * adoptServerNote (lib/offlineNotes.ts) — without the guard a server answering
 * garbage would be skipped in silence, which is the very failure mode this
 * change exists to remove. adoptServerNote itself is not reusable here: it also
 * upserts the summary list, which the caller has already merged.
 */
async function pullOneBody(id: string, fetchNote: NoteBodyFetcher): Promise<boolean> {
  const body = await fetchNote(id);
  if (body === null) {
    return false;
  }

  const parsed = NoteResponseSchema.safeParse(body);
  if (!parsed.success) {
    reportUnreadableResponse('pullNoteBody', body);
    return false;
  }

  // A body answering under a different id would overwrite the wrong cache entry.
  if (parsed.data.id !== id) {
    reportUnreadableResponse('pullNoteBody', body);
    return false;
  }

  setCachedNote(parsed.data);
  return true;
}

export interface NoteBodyPullResult {
  /** Ids whose cached body was replaced — the signal an open editor needs. */
  replaced: string[];
  /** Stale notes the server did not deliver, so the pull did not fully land. */
  failed: number;
}

/**
 * Refreshes every stale cached body.
 *
 * One failing fetch never stops the others — the outcome is per note. But the
 * failures are counted rather than swallowed: a sync where every body request
 * 404'd would otherwise report success, which is the exact silence this whole
 * change exists to remove.
 */
export async function pullStaleNoteBodies(
  summaries: NoteSummary[],
  fetchNote: NoteBodyFetcher,
): Promise<NoteBodyPullResult> {
  const queue = staleNoteBodyIds(summaries);
  const replaced: string[] = [];
  let failed = 0;
  let next = 0;

  const worker = async () => {
    for (let i = next++; i < queue.length; i = next++) {
      const id = queue[i];
      try {
        if (await pullOneBody(id, fetchNote)) {
          replaced.push(id);
        } else {
          failed++;
        }
      } catch {
        // Network error on a single note — the rest of the sync still stands.
        failed++;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));

  return { replaced, failed };
}
