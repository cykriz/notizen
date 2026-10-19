import { OFFLINE_PATH } from '@/lib/constants';
import { NOTES_PATH, NOTES_PATH_PREFIX } from '@/lib/pathConstants';
import { offlineHtmlResponse } from './offlineFallback';
import { PAGES_CACHE_MAX, shouldCacheNavigation, trimCache } from './swStrategies';

// How long a navigation waits on the network before a cached copy of the page
// is served instead. A very weak link rarely makes fetch REJECT — it just hangs
// until Safari gives up with "Server antwortet nicht mehr", and the catch-based
// fallback below never got its turn.
const NETWORK_TIMEOUT_MS = 3_000;

const TIMEOUT = Symbol('timeout');

/**
 * The cached copy of exactly this page (or the notes list for `/`). Used on a
 * timeout, so it deliberately excludes the generic note shell: on a slow but
 * working link, a note never opened on this device should keep loading from the
 * server instead of rendering an empty localStorage shell.
 */
async function cachedPage(request: Request): Promise<Response | undefined> {
  // ignoreVary: the warmed entry (cache.put with a string URL) carries no
  // Accept header, while a real navigation sends `Accept: text/html,...`.
  // If Next emits `Vary: Accept` on the document, a vary-sensitive match
  // would miss and fall through to /offline, defeating the warm cache.
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) {
    return cached;
  }

  if (new URL(request.url).pathname === '/') {
    return await caches.match(NOTES_PATH);
  }

  return undefined;
}

/**
 * Navigation: network-first with a timeout. After NETWORK_TIMEOUT_MS the cached
 * page is served while the request keeps running to refresh the cache; with
 * nothing cached, it keeps waiting. A network error falls back to the cache,
 * then the note shell, then the offline page.
 */
export async function networkFirstWithFallback(
  request: Request,
  cacheName: string,
  protectedPathnames: ReadonlySet<string>,
  notesShellPath: string,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const network = fetch(request);
  // Registered synchronously, before any await: after a timeout the page has
  // already been answered from cache, and this refresh is all that is left.
  // This reaction is attached before the race below, so it clones the body
  // before respondWith can start reading it.
  waitUntil(
    network
      .then(async (response) => {
        if (!shouldCacheNavigation(response)) {
          return;
        }

        const copy = response.clone();
        const cache = await caches.open(cacheName);
        await cache.put(request, copy);
        await trimCache(cacheName, PAGES_CACHE_MAX, protectedPathnames);
      })
      .catch(() => undefined),
  );

  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof TIMEOUT>((resolve) => {
      timer = setTimeout(resolve, NETWORK_TIMEOUT_MS, TIMEOUT);
    });
    const first = await Promise.race([network, timeout]).finally(() => {
      clearTimeout(timer);
    });
    if (first !== TIMEOUT) {
      return first;
    }

    return (await cachedPage(request)) ?? (await network);
  } catch {
    const cached = await cachedPage(request);
    if (cached) {
      return cached;
    }

    // Offline navigation to a note whose own HTML was never cached (e.g. a note
    // created offline): serve the generic note-detail shell so the SPA boots
    // and renders the note from localStorage, instead of the dead-end /offline.
    if (new URL(request.url).pathname.startsWith(NOTES_PATH_PREFIX)) {
      const shell = await caches.match(notesShellPath);
      if (shell) {
        return shell;
      }
    }

    return (await caches.match(OFFLINE_PATH)) ?? offlineHtmlResponse();
  }
}
