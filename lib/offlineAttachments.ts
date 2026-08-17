import { getCachedNote, getCachedNotesList, setCachedNote, setCachedNotesList } from '@/lib/localCache';
import type { Attachment, NoteSummary } from '@/lib/types';

// Client-side reconciliation after an attachment mutation. Attachments never
// enter the sync queue (SYNC_ENTITY knows only NOTE and TODO) and POST/DELETE
// leave note.md — and therefore updatedAt — untouched, so nothing else writes
// the new count back into the sidebar list. This file does, optimistically:
// the server recomputes attachmentCount from a readdir on every read, so its
// value wins again on the next save (adoptServerNote) or page load.
//
// Split in two on purpose, against the offlineNotes form (list in, list out,
// cache write inside): the pure half has to run as a setNotes(prev => …)
// updater, because a multi-file upload reports once per file and notesRef only
// refreshes on a React commit — a snapshot-based patch would keep just the last
// delta. The cache write must stay OUT of the updater (StrictMode runs those
// twice, which would apply the delta to localStorage twice).

// Keys, not status strings — nothing here belongs in lib/constants.ts.
export type AttachmentChange = { added: Attachment } | { removedId: string };

/**
 * Moves a count by the change's direction, floored at 0.
 *
 * The clamp is not cosmetic: a negative count would swallow the next increment
 * (-1 + 1 = 0, badge stays hidden while a file exists), and NoteSummarySchema
 * accepts any number, so it would never surface. One helper for both writers —
 * a clamp that only holds on one of them is a silently wrong badge.
 */
function shiftCount(count: number, change: AttachmentChange): number {
  return Math.max(0, count + ('added' in change ? 1 : -1));
}

/**
 * Shifts one row's attachmentCount by the change's delta. Pure.
 *
 * Never touches updatedAt: offlineNotes sends it as `expectedUpdatedAt`, so a
 * faked bump would turn the next save into a guaranteed 409 — and it would also
 * make mergeById prefer the local row forever, so the count could never
 * self-correct from the server again.
 */
export function applyAttachmentChange(
  notes: NoteSummary[],
  noteId: string,
  change: AttachmentChange,
): NoteSummary[] {
  const row = notes.find((n) => n.id === noteId);
  if (row === undefined) {
    // Unknown id — hand back the input so React bails out of the re-render.
    return notes;
  }

  const attachmentCount = shiftCount(row.attachmentCount, change);
  return notes.map((n) => (n === row ? { ...n, attachmentCount } : n));
}

/**
 * Writes the same change into both localStorage entries. Side effect only.
 *
 * The list is rebuilt from the CURRENT cache, not from React state — see
 * offlineAdopt: adoptServerNote reads getCachedNotesList() and setNotes() takes
 * that whole list, so a count living only in React state is dropped by the next
 * unrelated note mutation.
 *
 * The cached note is patched per field from its own previous value rather than
 * from the editor's attachments array: a metadata-only cache write leaves
 * `attachments: []` behind while attachmentCount is still > 0 (offlineNotes),
 * and that note can reach NoteEditor through NotePageClient. Moving each field
 * by the delta cannot make an already-incomplete list worse.
 */
export function cacheAttachmentChange(noteId: string, change: AttachmentChange): void {
  setCachedNotesList(applyAttachmentChange(getCachedNotesList(), noteId, change));

  const cached = getCachedNote(noteId);
  if (cached === null) {
    return;
  }

  // A save resolving between the POST and this call may have already adopted the
  // server's note, which then carries the new attachment; appending it a second
  // time would duplicate the row and overshoot the count. Only the added
  // direction can be told apart this way — a cached list *missing* a removed id
  // is also the normal state after a metadata-only cache write (attachments: []),
  // so removal stays unconditional.
  if ('added' in change && cached.attachments.some((a) => a.id === change.added.id)) {
    return;
  }

  const attachments = 'added' in change
    ? [...cached.attachments, change.added]
    : cached.attachments.filter((a) => a.id !== change.removedId);
  setCachedNote({
    ...cached,
    attachments,
    attachmentCount: shiftCount(cached.attachmentCount, change),
  });
}
