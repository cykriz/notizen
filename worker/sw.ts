import {
  OFFLINE_PATH,
  OFFLINE_SHELL_PATH,
  SHARE_PATH_PREFIX,
  SW_BYPASS_API_PREFIXES,
  SW_INTERNAL_HEADER,
  SW_MSG_CLEAR_AUTH_CACHES,
  SW_MSG_ENSURE_PRECACHE,
  SW_MSG_WARM_PAGE_CACHE,
} from '@/lib/constants';
import {
  CACHE,
  cacheFirst,
  networkFirst,
  networkFirstWithFallback,
  staleWhileRevalidate,
} from './swStrategies';
import { PROTECTED_PAGE_PATHS, STATIC_ASSET_PREFIX, ensurePrecached } from './swPrecache';
import { cacheNavigationHtml } from './swWarm';

declare const self: ServiceWorkerGlobalScope;

// ── Install ──────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Fire-and-forget on purpose: the install must not wait on activation.
  void self.skipWaiting();
  event.waitUntil(
    ensurePrecached().then(
      (report) => {
        // A precache that fails here (no valid session → 307 to /login, flaky
        // mobile link) used to be silent and permanent: the pages/static caches
        // are build-versioned, so a new deploy starts empty and nothing retried.
        // Say so, and let the first authenticated (app) mount repair it.
        if (report.missingPages.length > 0 || report.missingStatic > 0) {
          console.warn('[sw] Precache unvollständig nach install:', report);
        }
      },
      (error: unknown) => {
        // Swallowed on purpose. CacheStorage itself can reject (private
        // browsing, quota), and a rejected waitUntil fails the INSTALL — which
        // would leave no service worker at all, and therefore no repair path
        // either. An empty cache is recoverable; a missing SW is not.
        console.warn('[sw] Precache beim Install fehlgeschlagen:', error);
      },
    ),
  );
});

// ── Activate ─────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => {
        const valid = new Set<string>(Object.values(CACHE));
        return Promise.all(names.filter((n) => !valid.has(n)).map((n) => caches.delete(n)));
      })
      .then(() => self.clients.claim()),
  );
});

// ── Messages ────────────────────────────────────────────────────────
// `ExtendableMessageEvent.data` is `any` per spec, and the page posts an
// unconstrained value (`postToServiceWorker(message: unknown)`), so the SW has to
// validate rather than trust it — anything with a postMessage handle can reach
// here. Narrowing once up front also keeps the branches free of untyped reads.
interface SwMessage {
  type: string;
  url?: unknown;
}

function isSwMessage(data: unknown): data is SwMessage {
  return typeof data === 'object' && data !== null && 'type' in data && typeof data.type === 'string';
}

self.addEventListener('message', (event) => {
  const data: unknown = event.data;
  if (!isSwMessage(data)) {
    return;
  }

  if (data.type === SW_MSG_CLEAR_AUTH_CACHES) {
    event.waitUntil(Promise.all([caches.delete(CACHE.api), clearUserPages()]));
  } else if (data.type === SW_MSG_WARM_PAGE_CACHE && typeof data.url === 'string') {
    event.waitUntil(cacheNavigationHtml(data.url, PROTECTED_PAGE_PATHS));
  } else if (data.type === SW_MSG_ENSURE_PRECACHE) {
    const port = event.ports[0] as MessagePort | undefined;
    event.waitUntil(
      ensurePrecached().then(
        (report) => {
          port?.postMessage(report);
        },
        () => {
          port?.postMessage(null);
        },
      ),
    );
  }
});

// Everything in the pages cache is user-specific HTML — /notes and /todos carry
// the list, and even the note shell embeds the server-rendered sidebar — so all
// of it goes on logout. /offline is the one exception: a public route with no
// user data, and keeping it means a logged-out device still gets the themed
// offline page instead of the inline 503 last resort.
async function clearUserPages(): Promise<void> {
  const cache = await caches.open(CACHE.pages);
  for (const key of await cache.keys()) {
    if (new URL(key.url).pathname !== OFFLINE_PATH) {
      await cache.delete(key);
    }
  }
}

// ── Fetch ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Defensive: SW-initiated fetches (e.g. the warm fetches in swWarm.ts, which
  // carry this sentinel) don't re-enter this handler per the SW spec, so this
  // normally never matches. Kept in case a controlled client ever forwards a
  // request carrying the sentinel — it must bypass caching, not be re-stored.
  if (request.headers.get(SW_INTERNAL_HEADER) !== null) {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.method !== 'GET') {
    return;
  }

  // Public share routes must never be cached by the SW.
  if (url.pathname.startsWith(SHARE_PATH_PREFIX)) {
    return;
  }

  // Online-only endpoints (trash management, user settings) bypass the SW so
  // they always hit the network and never serve stale data or evict note data.
  if (SW_BYPASS_API_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithFallback(request, CACHE.pages, PROTECTED_PAGE_PATHS, OFFLINE_SHELL_PATH));
  } else if (url.pathname.startsWith(STATIC_ASSET_PREFIX)) {
    event.respondWith(cacheFirst(request, CACHE.static));
  } else if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, CACHE.api));
  } else {
    event.respondWith(staleWhileRevalidate(request, CACHE.misc));
  }
});
