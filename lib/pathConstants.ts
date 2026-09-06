import { OFFLINE_PATH, OFFLINE_SHELL_PATH } from './constants';

// Route paths that more than one layer needs to agree on (nav tabs, service
// worker, offline fallback chain, e2e). They live here rather than in
// lib/constants.ts because that file is at its 200-line cap — same split as
// lib/ttsConstants.ts / lib/failedSyncConstants.ts, imported directly.
export const NOTES_PATH = '/notes';
export const NOTES_PATH_PREFIX = '/notes/';
export const TODOS_PATH = '/todos';

// The two unauthenticated entry points. Agreed on by the proxy's public-prefix
// list, every server-side `redirect()` out of a protected tree, and the client's
// 401 handlers in tryFetch / syncReplay.
export const LOGIN_PATH = '/login';
export const SETUP_PATH = '/setup';

// The navigation documents the SW must always hold so an offline cold-load
// never dead-ends on the inline 503. Single source of truth for the install
// precache, the repair path, FIFO-eviction protection and the e2e spec.
export const SW_PRECACHE_PATHS = [
  OFFLINE_PATH,
  NOTES_PATH,
  TODOS_PATH,
  OFFLINE_SHELL_PATH,
] as const;
