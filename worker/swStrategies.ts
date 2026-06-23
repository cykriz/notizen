import { OFFLINE_PATH } from '@/lib/constants';
import { offlineDataResponse, offlineHtmlResponse } from './offlineFallback';

// Explicit type annotation (not `as const`): the `pages`/`static` names embed
// the build ID via a template literal, which can't be const-asserted in this
// position. The annotation preserves the same readonly-string API the rest of
// the codebase depends on. Both `pages-` and `static-` are versioned by build
// ID so each rebuild gets fresh caches — the activate sweep evicts the previous
// build's `pages-<oldId>`/`static-<oldId>`, preventing cross-build chunk-hash
// mismatches AND stopping `static` from accumulating dead chunks across deploys
// (it has no FIFO trim, so versioning is what bounds its growth).
export const CACHE: {
  readonly static: string;
  readonly pages: string;
  readonly api: string;
  readonly misc: string;
} = {
  static: `static-${process.env.SW_BUILD_ID}`,
  pages: `pages-${process.env.SW_BUILD_ID}`,
  api: 'api-v1',
  misc: 'misc-v1',
};

export const PAGES_CACHE_MAX = 100;
export const API_CACHE_MAX = 20;
export const MISC_CACHE_MAX = 50;

// Responses larger than this (e.g. video/audio attachments) are not written to
// the api cache: they would flood the 20-entry FIFO and evict note data. Small
// attachments fetched without a Range header (the <a download> path) stay
// cached for offline download. Inline media playback always sends a Range
// header → 206, which is never cached (the Cache API rejects partials anyway).
export const API_CACHE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * A navigation response is safe to cache only when it's a non-redirected 2xx
 * for the requested URL. Redirected responses (e.g. /notes → /login when the
 * session expires) would otherwise be stored under the original request URL
 * with content for a different URL, serving stale auth UI to authenticated
 * users on later visits.
 */
export function shouldCacheNavigation(response: Response): boolean {
  return response.ok && !response.redirected;
}

export async function trimCache(
  cacheName: string,
  maxEntries: number,
  protectedPathnames: ReadonlySet<string> | null = null,
): Promise<void> {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // FIFO eviction by insertion order — precached entries sit at the head of
  // the list and would be evicted first. Skip them so precached shells stay
  // reliable once warming fills the cap.
  const evictable = protectedPathnames
    ? keys.filter((k) => !protectedPathnames.has(new URL(k.url).pathname))
    : keys;
  for (const key of evictable.slice(0, keys.length - maxEntries)) {
    await cache.delete(key);
  }
}

/** Navigation: network-first, fall back to cache, then offline page. */
export async function networkFirstWithFallback(
  request: Request,
  cacheName: string,
  protectedPathnames: ReadonlySet<string>,
  notesShellPath: string,
): Promise<Response> {
  try {
    const response = await fetch(request);
    if (shouldCacheNavigation(response)) {
      const cache = await caches.open(cacheName);
      void cache
        .put(request, response.clone())
        .then(() => trimCache(cacheName, PAGES_CACHE_MAX, protectedPathnames))
        .catch(() => undefined);
    }
    return response;
  } catch {
    // ignoreVary: the warmed entry (cache.put with a string URL) carries no
    // Accept header, while a real navigation sends `Accept: text/html,...`.
    // If Next emits `Vary: Accept` on the document, a vary-sensitive match
    // would miss and fall through to /offline, defeating the warm cache.
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    const pathname = new URL(request.url).pathname;
    if (pathname === '/') {
      const home = await caches.match('/notes');
      if (home) {
        return home;
      }
    }
    // Offline navigation to a note whose own HTML was never cached (e.g. a note
    // created offline): serve the generic note-detail shell so the SPA boots
    // and renders the note from localStorage, instead of the dead-end /offline.
    if (pathname.startsWith('/notes/')) {
      const shell = await caches.match(notesShellPath);
      if (shell) return shell;
    }
    const fallback = await caches.match(OFFLINE_PATH);
    if (fallback) return fallback;
    return offlineHtmlResponse();
  }
}

/**
 * A 2xx response is safe to store only when it isn't a partial (206 — the Cache
 * API rejects those) and isn't a large media file (would evict note data from
 * the small FIFO api cache). Missing Content-Length → treat as small.
 */
function isCacheableApiResponse(response: Response): boolean {
  if (!response.ok || response.status === 206) return false;
  const len = response.headers.get('content-length');
  return len === null || Number(len) <= API_CACHE_MAX_BYTES;
}

/** API / data: network-first, fall back to cache. Never cache 401s. */
export async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (isCacheableApiResponse(response)) {
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
export async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
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
export async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
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
