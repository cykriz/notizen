// User-facing labels for the command palette's note-create row. Kept out of lib/constants.ts
// (at its 200-line cap) and single-sourced the way tagConstants is: both strings are what the
// e2e tests locate the row by, so a rename here must not silently turn a locator into a no-op.

/** Group heading above the create row in note mode.
 *
 *  Deliberately NOT "Neue Notiz": that is already the sidebar footer's button, which several
 *  e2e tests locate by name. Same caution as the tag pendant, which reads "Neuer Tag" and not
 *  "Ordner". */
export const NOTE_CREATE_GROUP_LABEL = 'Erstellen';

/** Visible text of that create row — and the e2e locator for it. */
export const noteCreateLabel = (title: string): string => `Notiz »${title}« erstellen`;
