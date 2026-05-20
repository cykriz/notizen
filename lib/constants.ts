import type { PreviewMode, QuadrantMeta, SyncAction, SyncEntityType } from './types';

export const AUTH_COOKIE_NAME = 'notizen-session';
export const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
export const AUTH_DIR = '.auth';
export const USERS_FILE = 'users.json';
export const AUTH_SECRET_FILE = 'secret.key';
export const USERS_DATA_DIR = 'users';
export const USERNAME_RE = /^[a-z0-9_-]{1,32}$/;

export const FEEDBACK_FLASH_MS = 1500;

// SW protocol / paths handled by the service worker
export const SW_MSG_CLEAR_AUTH_CACHES = 'CLEAR_AUTH_CACHES';
export const OFFLINE_PATH = '/offline';

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
