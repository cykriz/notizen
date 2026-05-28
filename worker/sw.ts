import { OFFLINE_PATH, SHARE_PATH_PREFIX, SW_MSG_CLEAR_AUTH_CACHES } from '@/lib/constants';
import { offlineHtmlResponse, offlineDataResponse } from './offlineFallback';

declare const self: ServiceWorkerGlobalScope;

const CACHE = {
  static: 'static-v1',
  pages: 'pages-v2',
  api: 'api-v1',
  misc: 'misc-v1',
} as const;

// /login is intentionally not precached: CLEAR_AUTH_CACHES wipes the pages
// cache on logout, so any cached login page would be erased anyway.
// Precache is best-effort: /notes redirects to /login (or /setup when no
// users exist) on an unauthenticated SW install and will be skipped by
// shouldCacheNavigation. The network-first navigation handler caches it on
// the first authenticated visit.
const PRECACHE_URLS = [OFFLINE_PATH, '/notes'];
const PAGES_CACHE_MAX = 30;
const API_CACHE_MAX = 20;
const MISC_CACHE_MAX = 50;

// ── Install ──────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precacheRoutes());
});

async function precacheRoutes(): Promise<void> {
  const cache = await caches.open(CACHE.pages);
  // Individual cache.put calls inside Promise.allSettled so a single failure
  // (e.g. /notes redirecting to /login for an unauthenticated SW install)
  // doesn't abort the whole install like cache.addAll would.
  await Promise.allSettled(
    PRECACHE_URLS.map(async (url) => {
      const response = await fetch(url, { credentials: 'same-origin', redirect: 'follow' });
      if (shouldCacheNavigation(response)) {
        await cache.put(url, response);
      }
    }),
  );
}

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

// ── Auth Cache Clearing ─────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const msgEvent = event as ExtendableMessageEvent;
  if (msgEvent.data?.type === SW_MSG_CLEAR_AUTH_CACHES) {
    msgEvent.waitUntil(Promise.all([caches.delete(CACHE.api), caches.delete(CACHE.pages)]));
  }
});

// ── Fetch ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  // Public share routes must never be cached by the SW: revocation/expiry
  // must take effect immediately, and the owner's device would otherwise
  // serve stale pages to anonymous viewers on the same device.
  if (url.pathname.startsWith(SHARE_PATH_PREFIX)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithFallback(request, CACHE.pages));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, CACHE.static));
  } else if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, CACHE.api));
  } else {
    event.respondWith(staleWhileRevalidate(request, CACHE.misc));
  }
});

// ── Cache Maintenance ────────────────────────────────────────────────

async function trimCache(cacheName: string, maxEntries: number): Promise<void> {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    for (const key of keys.slice(0, keys.length - maxEntries)) {
      await cache.delete(key);
    }
  }
}

// ── Strategies ───────────────────────────────────────────────────────

/**
 * A navigation response is safe to cache only when it's a non-redirected 2xx
 * for the requested URL. Redirected responses (e.g. /notes → /login when the
 * session expires) would otherwise be stored under the original request URL
 * with content for a different URL, serving stale auth UI to authenticated
 * users on later visits.
 */
function shouldCacheNavigation(response: Response): boolean {
  return response.ok && !response.redirected;
}

/** Navigation: network-first, fall back to cache, then offline page. */
async function networkFirstWithFallback(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (shouldCacheNavigation(response)) {
      const cache = await caches.open(cacheName);
      // Fire-and-forget; chain trim after put so the cap stays exact. Catch
      // swallows rejection (e.g. browser refusing to cache a redirected
      // response) so it doesn't surface as an unhandled rejection.
      void cache
        .put(request, response.clone())
        .then(() => trimCache(cacheName, PAGES_CACHE_MAX))
        .catch(() => undefined);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // PWA start_url is "/", which 307s to /notes. The redirect itself can't be
    // cached under "/", so an offline cold-launch from the home-screen icon
    // would otherwise fall through to /offline. Serve the cached /notes shell
    // instead when it's available.
    if (new URL(request.url).pathname === '/') {
      const home = await caches.match('/notes');
      if (home) {
        return home;
      }
    }
    const fallback = await caches.match(OFFLINE_PATH);
    if (fallback) return fallback;
    return offlineHtmlResponse();
  }
}

/** API / data: network-first, fall back to cache. Never cache 401s. */
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      void cache
        .put(request, response.clone())
        .then(() => trimCache(cacheName, API_CACHE_MAX))
        .catch(() => undefined);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? offlineDataResponse();
  }
}

/** Static assets: cache-first (hashed filenames = immutable). */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      void cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    return offlineDataResponse();
  }
}

/** Everything else: serve from cache immediately, update in background. */
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache
          .put(request, response.clone())
          .then(() => trimCache(cacheName, MISC_CACHE_MAX))
          .catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);

  return cached ?? (await fetchPromise) ?? offlineDataResponse();
}
