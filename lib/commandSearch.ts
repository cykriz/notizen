import { defaultFilter } from 'cmdk';
import { COMMAND_RESULT_LIMIT } from './constants';
import { isCreatableTagPath, normalizeTagPath, type TagPathEntry } from './tagTree';
import type { NoteSummary } from './types';

/**
 * Fuzzy-ranks `items` against `query`, best match first, capped at COMMAND_RESULT_LIMIT.
 *
 * Why this exists instead of letting cmdk filter: cmdk scores the CommandItem `value`
 * together with its `keywords` as ONE string, and `value` has to stay the note id so the
 * selection stays unambiguous for same-titled notes. A UUID at the front of the haystack
 * both matches hex-only queries ('abc', 'de', 'face') in *every* note and steals the
 * start-of-string bonus from the real title — an irrelevant note whose id starts with
 * 'abc' outscored a note actually titled "ABC-Analyse". Scoring `toText(item)` alone
 * fixes both. Callers pass `shouldFilter: false` so cmdk neither re-scores nor re-sorts
 * the DOM behind React's back.
 *
 * `defaultFilter` is called without the `keywords` argument on purpose: the haystack is
 * then exactly `toText(item)`.
 */
export function rankByQuery<T>(items: T[], query: string, toText: (item: T) => string): T[] {
  if (query === '') {
    return items.slice(0, COMMAND_RESULT_LIMIT);
  }

  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const score = defaultFilter(toText(item), query);
    if (score > 0) {
      scored.push({ item, score });
    }
  }

  // Array.prototype.sort is stable, so equal scores keep the incoming order — which for
  // notes is the sortNotesForPalette order below.
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, COMMAND_RESULT_LIMIT).map((entry) => entry.item);
}

/**
 * The tag path an `@…` query would create, or null when there is nothing to create: an
 * unwritable input (empty or reserved), or a path that already exists.
 *
 * The exists check is an exact match and needs no prefix logic: `listAllTagPaths` walks the
 * whole tree, so every intermediate folder ('arbeit' above 'arbeit/alpha') is in `existing`
 * under its own path.
 */
export function tagCreateCandidate(rawQuery: string, existing: readonly TagPathEntry[]): string | null {
  const path = normalizeTagPath(rawQuery);
  if (!isCreatableTagPath(path) || existing.some((entry) => entry.path === path)) {
    return null;
  }

  return path;
}

/** Searchable text of a note: title plus its tags as #hashtags, matching what the row shows. */
export function noteSearchText(note: NoteSummary): string {
  return [note.title, ...note.tags.map((t) => `#${t}`)].join(' ');
}

/**
 * Order for an empty query: pinned first, then most recently updated.
 *
 * Pinned-first is deliberate new behaviour for the palette — no other list in the app is
 * ordered that way (the server sorts by `updatedAt` only, see listNotes in fsNotes.ts, and
 * the sidebar surfaces pinned notes as a separate group in useSidebarChrome).
 *
 * Sorting client-side rather than sharing the server comparator is also deliberate: the
 * ranking differs (extra pin tier), and the client list drifts from the server order
 * anyway because offlineNotes prepends new notes and updates existing ones in place.
 */
export function sortNotesForPalette(notes: NoteSummary[]): NoteSummary[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
