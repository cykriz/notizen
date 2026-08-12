// User-facing labels for the sidebar tag navigation. Kept out of lib/constants.ts
// (at its 200-line cap) and single-sourced the way failedSyncConstants is: these
// strings are the accessible names the e2e tests locate their buttons by, so a
// rename here must not silently turn a locator into a no-op.

export const TAG_FOLDER_DELETE_LABEL = 'Ordner löschen';

/** Title of the breadcrumb's "…" button, which jumps to the deepest hidden ancestor. */
export const tagBreadcrumbJumpLabel = (path: string): string => `Zu ${path}`;
