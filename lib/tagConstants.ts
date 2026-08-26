// User-facing labels for the sidebar tag navigation, the command palette's tag mode and the
// sidebar's folder-create dialog.
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

// --- CreateTagFolderDialog, opened from the sidebar footer's NEW_FOLDER_LABEL button ---

/** The name field's only naming — it carries no label and no aria-label. */
export const FOLDER_NAME_PLACEHOLDER = 'Ordnername…';

/** Shown instead of the path preview once any segment collides with a synthetic folder.
 *  The one rejection reason the dialog spells out; the rest just disable the button. */
export const FOLDER_RESERVED_HINT = 'Dieser Name ist reserviert.';

/** Lead-in of the live path preview. Only the prefix, because the path itself stays in its
 *  own `font-mono` span — `folderPathHint` below assembles what the user actually reads. */
export const FOLDER_PATH_HINT_PREFIX = 'Pfad:';

/** The assembled preview text, as it arrives on screen across those two nodes — and the e2e
 *  locator for it. Not used by the dialog itself, which renders the prefix and the span. */
export const folderPathHint = (path: string): string => `${FOLDER_PATH_HINT_PREFIX} ${path}`;

/** Both dialog descriptions end on this: a tag exists only as frontmatter, so the folder IS
 *  its first note. Shared so a reword cannot land on only one of the two. */
const FOLDER_FIRST_NOTE_SUFFIX = 'Eine erste Notiz wird darin angelegt.';

/** Dialog description with no active folder: whatever is typed becomes a top-level folder. */
export const FOLDER_ROOT_DESCRIPTION = `Neuer Ordner auf oberster Ebene. ${FOLDER_FIRST_NOTE_SUFFIX}`;

/** Dialog description while browsing a folder — the only place the user sees which parent the
 *  typed name will be prefixed with. */
export const folderParentDescription = (parent: string): string =>
  `Neuer Ordner unter »${parent}«. ${FOLDER_FIRST_NOTE_SUFFIX}`;
