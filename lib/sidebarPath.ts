import { FAILED_SYNC_TAG } from './constants';
import { noteTagPath } from './noteUtils';
import { isNoteAtPath, isTagOnOrUnder } from './tagTree';
import type { NoteSummary } from './types';

/**
 * The folder the sidebar shows after the open note changed — another note was opened, or the
 * open note's tags changed.
 *
 * Keeps `path` while the note is listed there, so a note carrying several tags does not yank
 * the user out of the folder they opened it from. Otherwise it follows the note: to the tag
 * nearest the current context (on or below `path`), else to the note's default folder.
 *
 * `failed` says whether the note is listed in the synthetic sync-fehler folder: the caller
 * passes notes without the synthetic tag, so the tags alone cannot tell.
 */
export function resolveSidebarPath(path: string, note: NoteSummary, failed: boolean): string {
  if ((path === FAILED_SYNC_TAG && failed) || isNoteAtPath(note, path)) {
    return path;
  }

  return note.tags.find((t) => isTagOnOrUnder(t, path)) ?? noteTagPath(note);
}
