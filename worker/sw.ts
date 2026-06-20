import {
  OFFLINE_PATH,
  OFFLINE_SHELL_PATH,
  SHARE_PATH_PREFIX,
  SW_INTERNAL_HEADER,
  SW_MSG_CLEAR_AUTH_CACHES,
  SW_MSG_WARM_PAGE_CACHE,
} from '@/lib/constants';
import {
  CACHE,
  cacheFirst,
  networkFirst,
  networkFirstWithFallback,
  shouldCacheNavigation,
  staleWhileRevalidate,
} from './swStrategies';
import { cacheNavigationHtml } from './swWarm';

declare const self: ServiceWorkerGlobalScope;

const PRECACHE_URLS = [OFFLINE_PATH, '/notes', '/todos', OFFLINE_SHELL_PATH];
// Pathnames protected from FIFO eviction in pages-v2. Frozen so the strategies
// module can take it as ReadonlySet without copying.
const PROTECTED_PAGE_PATHS: ReadonlySet<string> = new Set(PRECACHE_URLS);

// ── Install ──────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.all([precacheRoutes(), precacheStaticAssets()]));
});

async function precacheRoutes(): Promise<void> {
  const cache = await caches.open(CACHE.pages);
  await Promise.allSettled(
    PRECACHE_URLS.map(async (url) => {
      const response = await fetch(url, { credentials: 'same-origin', redirect: 'follow' });
      if (shouldCacheNavigation(response)) {
        await cache.put(url, response);
      }
    }),
  );
}

// Precache EVERY build asset under /_next/static into static-<buildId> at
// install. Serwist injects the full build manifest at `self.__SW_MANIFEST`
// (build-time esbuild define). This covers dynamically-imported chunks
// (next/dynamic, e.g. MarkdownPreview) that never appear in any page's HTML
// and so can't be warmed by HTML parsing — without them an offline cold-load
// of a note hits ChunkLoadError. Manifest excludes files > 2 MiB.
async function precacheStaticAssets(): Promise<void> {
  const urls = (self.__SW_MANIFEST ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry.url))
    .filter((url) => url.startsWith('/_next/static/'));
  if (urls.length === 0) return;
  const cache = await caches.open(CACHE.static);
  await Promise.allSettled(
    urls.map(async (url) => {
      // Hashed filenames are immutable — skip if already cached.
      if (await cache.match(url)) return;
      const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { [SW_INTERNAL_HEADER]: '1' },
      });
      if (response.ok) {
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

// ── Messages ────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const msgEvent = event as ExtendableMessageEvent;
  const data = msgEvent.data;
  if (data?.type === SW_MSG_CLEAR_AUTH_CACHES) {
    msgEvent.waitUntil(Promise.all([caches.delete(CACHE.api), caches.delete(CACHE.pages)]));
  } else if (data?.type === SW_MSG_WARM_PAGE_CACHE && typeof data.url === 'string') {
    msgEvent.waitUntil(cacheNavigationHtml(data.url, PROTECTED_PAGE_PATHS));
  }
});

// ── Fetch ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Defensive: SW-initiated fetches (e.g. the warm fetches in swWarm.ts, which
  // carry this sentinel) don't re-enter this handler per the SW spec, so this
  // normally never matches. Kept in case a controlled client ever forwards a
  // request carrying the sentinel — it must bypass caching, not be re-stored.
  if (request.headers.get(SW_INTERNAL_HEADER) !== null) return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  // Public share routes must never be cached by the SW.
  if (url.pathname.startsWith(SHARE_PATH_PREFIX)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithFallback(request, CACHE.pages, PROTECTED_PAGE_PATHS, OFFLINE_SHELL_PATH));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, CACHE.static));
  } else if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, CACHE.api));
  } else {
    event.respondWith(staleWhileRevalidate(request, CACHE.misc));
  }
});
