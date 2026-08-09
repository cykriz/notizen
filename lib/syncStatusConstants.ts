// German UI strings for the sync indicator in the sidebar header. Own module,
// not failedSyncConstants.ts (scoped to the inspector) and not constants.ts
// (at its 200-line cap) — same precedent as lib/ttsConstants.ts. Giving the E2E
// suite a stable import is the other reason these are not inlined.

export const SYNC_IDLE_LABEL = 'Manuell synchronisieren';
export const SYNC_IDLE_TITLE = 'Synchronisiert — klicken zum Aktualisieren';
export const SYNC_ERROR_TITLE = 'Aktualisierung fehlgeschlagen';

// The pending branch used to be an inert <span>: the icon stopped being a button
// exactly when there was unsent work. It is clickable now, and the wording
// promises only what it does — the automatic retry loop runs either way, so a
// click means "try now", not "this is the only way it will ever sync".
export const SYNC_PENDING_LABEL = 'Jetzt synchronisieren';
export const SYNC_PENDING_TITLE = 'Änderungen werden übertragen — klicken, um es sofort zu versuchen';

// Offline stays inert: there is nothing a click could do. The title says what
// happens instead, rather than leaving a bare "Offline".
export const SYNC_OFFLINE_TITLE = 'Offline — Änderungen werden bei Verbindung übertragen';
