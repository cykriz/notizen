// User-facing labels for the sidebar tag navigation. Kept out of lib/constants.ts
// (at its 200-line cap) and single-sourced the way failedSyncConstants is: most of
// these are the accessible names the e2e tests locate their buttons by, so a rename
// here must not silently turn a locator into a no-op. The one exception is marked.

export const TAG_FOLDER_DELETE_LABEL = 'Ordner löschen';

/** Accessible name of the breadcrumb's back button, which opens the path menu. */
export const TAG_BREADCRUMB_UP_LABEL = 'Übergeordnete Ordner';

/** The path menu's root entry — root has no segment name of its own. */
export const TAG_ROOT_LABEL = 'Alle Tags';

/** Hover-only tooltip on a path-menu row, spelling out the full path its segment
 *  stands for. Deliberately NOT the row's accessible name: the row has visible
 *  text, and that text wins — locate those rows by their segment, not by this. */
export const tagBreadcrumbJumpLabel = (path: string): string => `Zu ${path}`;
