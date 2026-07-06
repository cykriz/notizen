import type { PreviewMode, QuadrantMeta, SyncAction, SyncEntityType } from './types';

export const AUTH_COOKIE_NAME = 'notizen-session';
export const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
export const AUTH_DIR = '.auth';
export const USERS_FILE = 'users.json';
export const AUTH_SECRET_FILE = 'secret.key';
export const USERS_DATA_DIR = 'users';
export const USERNAME_RE = /^[a-z0-9_-]{1,32}$/;

export const FEEDBACK_FLASH_MS = 1500;

// Used by app/(app)/error.tsx to keep error messaging consistent.
// app/global-error.tsx must stay import-free (root error boundary constraint)
// and inlines its own copy of these strings.
export const ERROR_OFFLINE_TITLE = 'Keine Verbindung';
export const ERROR_OFFLINE_BODY = 'Diese Seite wurde noch nicht für die Offline-Nutzung zwischengespeichert.';
export const ERROR_GENERIC_TITLE = 'Etwas ist schiefgelaufen';
export const ERROR_GENERIC_BODY = 'Ein unerwarteter Fehler ist aufgetreten.';
export const ERROR_RETRY_LABEL = 'Erneut versuchen';

// Reserved note id used to precache a generic note-detail "shell" document
// (getNote returns null for it, so page.tsx server-renders with note=null).
// The SW serves this shell for offline navigations to notes whose own HTML was
// never cached — e.g. notes created while offline — so the SPA still boots; the
// client then reads the real id from the address bar and renders the note from
// localStorage. Not a UUID, so it can never collide with a real note id.
export const OFFLINE_SHELL_ID = '__offline_shell__';
export const OFFLINE_SHELL_PATH = `/notes/${OFFLINE_SHELL_ID}`;

// SW protocol / paths handled by the service worker
export const SW_MSG_CLEAR_AUTH_CACHES = 'CLEAR_AUTH_CACHES';
export const SW_MSG_WARM_PAGE_CACHE = 'WARM_PAGE_CACHE';
// Header set on the SW's internal warm fetch so the fetch listener can skip
// re-intercepting it (otherwise the warm response would also land in misc-v1
// via staleWhileRevalidate).
export const SW_INTERNAL_HEADER = 'x-sw-internal';
export const OFFLINE_PATH = '/offline';

// API routes the service worker must NOT touch: online-only trash management +
// per-user settings. Bypassing keeps them out of the small api-v1 FIFO (so they
// never evict note/todo data) and prevents serving stale trash offline.
export const SW_BYPASS_API_PREFIXES = ['/api/trash', '/api/user/settings'] as const;

export const SHARES_DIR = '.shares';
export const SHARES_FILE = 'shares.json';
export const SHARE_PATH_PREFIX = '/share/';
export const SHARE_CACHE_CONTROL = 'private, max-age=0, must-revalidate';

export const SHARE_EXPIRY_PRESETS = {
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  never: null,
} as const;

export type ShareExpiryPreset = keyof typeof SHARE_EXPIRY_PRESETS;
export const DEFAULT_SHARE_EXPIRY: ShareExpiryPreset = '1w';

export const SHARE_EXPIRY_LABELS: Record<ShareExpiryPreset, string> = {
  '1d': '1 Tag',
  '1w': '1 Woche',
  '1m': '1 Monat',
  never: 'Unbegrenzt',
};

export const INLINE_SAFE_MIMES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

export const DEFAULT_NOTE_TITLE = 'Unbenannt';

export const PREVIEW_MODES: readonly PreviewMode[] = ['edit', 'preview'];
export const PREVIEW_EDIT: PreviewMode = 'edit';
export const PREVIEW_PREVIEW: PreviewMode = 'preview';

export const SYNC_ENTITY = {
  NOTE: 'note',
  TODO: 'todo',
} as const satisfies Record<string, SyncEntityType>;

export const SYNC_ACTION = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
} as const satisfies Record<string, SyncAction>;

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
export const SYNC_MAX_RETRIES = 5;
export const FAILED_SYNC_TAG = 'sync-fehler';

// Reserved client-only tag markers injected at render time (e.g. by
// `withFailedSyncTag`) — users must not be able to author them as real tags.
export const RESERVED_TAGS = new Set<string>([FAILED_SYNC_TAG]);
export const isReservedTag = (t: string): boolean => RESERVED_TAGS.has(t);
// True if any slash-separated segment of the path is a reserved marker, e.g.
// 'sync-fehler/foo' — blocks authoring tags that collide with synthetic folders.
export const pathHasReservedSegment = (path: string): boolean => path.split('/').some(isReservedTag);

// dataTransfer MIME used when dragging a note row onto a tag folder in the sidebar.
export const NOTE_DRAG_MIME = 'application/x-note-id';
// dataTransfer MIME for dragging a multi-note selection onto a tag folder.
// Payload is JSON.stringify(string[]) of the selected note ids.
export const NOTE_IDS_DRAG_MIME = 'application/x-note-ids';

// Sidebar multi-select labels
export const SELECT_NOTES_LABEL = 'Auswählen';
export const ASSIGN_TAGS_LABEL = 'Tags vergeben';
export const APPLY_LABEL = 'Übernehmen';
export const CANCEL_LABEL = 'Abbrechen';
export const SELECTED_COUNT_SUFFIX = 'ausgewählt'; // rendered as `${n} ausgewählt`

export const NEW_FOLDER_LABEL = 'Neuer Ordner';
export const SYNC_HEALTH_POLL_MS = 10_000;
export const SYNC_RETRY_INTERVAL_MS = 10_000;
export const SYNC_RETRY_MAX_INTERVAL_MS = 5 * 60_000; // 5 min cap
export const DRAFT_DEBOUNCE_MS = 300;

export const QUADRANT = {
  DO: 'do',
  SCHEDULE: 'schedule',
  DELEGATE: 'delegate',
  PLANNED: 'planned',
} as const;

export type TodoQuadrant = (typeof QUADRANT)[keyof typeof QUADRANT];

export const QUADRANT_KEYS = Object.values(QUADRANT);

export const QUADRANT_META: readonly QuadrantMeta[] = [
  { key: QUADRANT.DO, label: 'Erledigen', description: 'Wichtig & Dringend' },
  { key: QUADRANT.SCHEDULE, label: 'Einplanen', description: 'Wichtig & Nicht dringend' },
  { key: QUADRANT.DELEGATE, label: 'Delegieren', description: 'Nicht wichtig & Dringend' },
  { key: QUADRANT.PLANNED, label: 'Eingeplant', description: 'Nicht wichtig & Nicht dringend' },
];

// --- Papierkorb (Trash) & per-user settings ---
// Per-user trash lives at {userRoot}/.trash/ (sibling of notes/ and todos.json),
// so listNotes/findSlugByNoteId (which only read root/notes) never see it.
export const TRASH_DIR = '.trash';
export const TRASH_NOTES_DIR = 'notes';
export const SETTINGS_FILE = 'settings.json';

// Auto-purge is OPPORTUNISTIC (no scheduler/cron in this DB-less app): it runs
// when the trash is opened (GET /api/trash) and when the retention is changed.
// A trash that is never reopened is not purged until the next visit — accepted.
export const DEFAULT_TRASH_RETENTION_DAYS = 30;
export const MIN_TRASH_RETENTION_DAYS = 1;
export const MAX_TRASH_RETENTION_DAYS = 365;
export const TRASH_RETENTION_OPTIONS: readonly { days: number; label: string }[] = [
  { days: 7, label: '7 Tage' },
  { days: 14, label: '14 Tage' },
  { days: 30, label: '30 Tage' },
  { days: 90, label: '90 Tage' },
];

// German UI strings (single-sourced, never inline in components).
export const PAPIERKORB_LABEL = 'Papierkorb';
export const TRASH_CLOSE_LABEL = 'Papierkorb schließen';
export const VIEW_TAGS_LABEL = 'Nach Tags';
export const VIEW_ALL_LABEL = 'Alle Notizen';
export const TODOS_OVERVIEW_LABEL = 'Übersicht';
export const TRASH_EMPTY_ACTION_LABEL = 'Papierkorb leeren';
export const TRASH_RESTORE_LABEL = 'Wiederherstellen';
export const TRASH_DELETE_PERMANENT_LABEL = 'Endgültig löschen';
export const TRASH_ONLINE_ONLY_MESSAGE = 'Der Papierkorb ist nur online verfügbar.';
export const TRASH_EMPTY_STATE_MESSAGE = 'Der Papierkorb ist leer.';
export const TRASH_LOAD_ERROR_MESSAGE = 'Der Papierkorb konnte nicht geladen werden.';
export const TRASH_NOTES_SECTION_LABEL = 'Notizen';
export const TRASH_TODOS_SECTION_LABEL = 'Aufgaben';
export const TRASH_RETENTION_LABEL = 'Automatisch löschen nach';
