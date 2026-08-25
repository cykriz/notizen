// User-facing labels for the sidebar tag navigation and the command palette's tag mode.
// Kept out of lib/constants.ts
// (at its 200-line cap) and single-sourced the way failedSyncConstants is: most of
// these are the accessible names the e2e tests locate their buttons by, so a rename
// here must not silently turn a locator into a no-op. The one exception is marked.

export const TAG_FOLDER_DELETE_LABEL = 'Ordner löschen';

/** Accessible name of the breadcrumb's back button in its menu form — two or more jump
 *  targets, i.e. root plus at least one ancestor. */
export const TAG_BREADCRUMB_UP_LABEL = 'Übergeordnete Ordner';

/** Accessible name of the same button in its direct form, where root is the only target
 *  left. Deliberately not TAG_ROOT_LABEL, which names the menu row to the same place:
 *  one string for both would leave every locator unable to tell them apart. */
export const TAG_BREADCRUMB_TO_ROOT_LABEL = 'Zurück zu allen Tags';

/** The path menu's root entry — root has no segment name of its own. */
export const TAG_ROOT_LABEL = 'Alle Tags';

/** Group heading above the palette's create row in `@` mode. Deliberately "Tag" and not
 *  "Ordner" like NEW_FOLDER_LABEL: the group above it is headed "Tags", and the user typed a
 *  tag path — the folder framing belongs to the sidebar, where folders are what you browse. */
export const TAG_CREATE_GROUP_LABEL = 'Neuer Tag';

/** Visible text of that create row — and the e2e locator for it. */
export const tagCreateLabel = (path: string): string => `Tag »${path}« erstellen`;

/** Hover-only tooltip on a path-menu row, spelling out the full path its segment
 *  stands for. Deliberately NOT the row's accessible name: the row has visible
 *  text, and that text wins — locate those rows by their segment, not by this. */
export const tagBreadcrumbJumpLabel = (path: string): string => `Zu ${path}`;
