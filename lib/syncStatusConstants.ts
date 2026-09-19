// German UI strings and flash timings for the sync indicator in the sidebar header. Own module,
// not failedSyncConstants.ts (scoped to the inspector) and not constants.ts
// (at its 200-line cap) — same precedent as lib/ttsConstants.ts. Giving the E2E
// suite a stable import is the other reason these are not inlined.

export const SYNC_IDLE_LABEL = 'Manuell synchronisieren';
export const SYNC_IDLE_TITLE = 'Synchronisiert — klicken zum Aktualisieren';
export const SYNC_ERROR_TITLE = 'Aktualisierung fehlgeschlagen';

// Success needs its own wording: without it a sync that pulled changes and one
// that had nothing to do look identical, which is what made the button feel dead.
// Only the title changes, never the aria-label — the label is how the E2E suite
// and screen readers address the button, and it must not move under them.
export const SYNC_DONE_TITLE = 'Mit dem Server abgeglichen';

// How long each flash stays up. Here rather than in lib/constants.ts for the
// same reason the strings above are: that file is at its 200-line cap. The
// error flash is the longer of the two — it asks the user to act, the success
// flash only confirms.
export const SYNC_DONE_FLASH_MS = 2_000;
export const SYNC_ERROR_FLASH_MS = 3_000;

// The pending branch used to be an inert <span>: the icon stopped being a button
// exactly when there was unsent work. It is clickable now, and the wording
// promises only what it does — the automatic retry loop runs either way, so a
// click means "try now", not "this is the only way it will ever sync".
export const SYNC_PENDING_LABEL = 'Jetzt synchronisieren';
export const SYNC_PENDING_TITLE = 'Änderungen werden übertragen — klicken, um es sofort zu versuchen';

// Offline stays inert: there is nothing a click could do. The title says what
// happens instead, rather than leaving a bare "Offline".
export const SYNC_OFFLINE_TITLE = 'Offline — Änderungen werden bei Verbindung übertragen';
