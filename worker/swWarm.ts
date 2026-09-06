import { SW_INTERNAL_HEADER } from '@/lib/constants';
import { NOTES_PATH_PREFIX } from '@/lib/pathConstants';
import { CACHE, PAGES_CACHE_MAX, shouldCacheNavigation, trimCache } from './swStrategies';

// Matches `/_next/static/chunks/<hash>.js` and `/_next/static/css/<hash>.css`
// references in the cached HTML. We warm all of them into the static cache so
// a future offline cold-load can hydrate without missing chunks.
const STATIC_ASSET_RE = /\/_next\/static\/(?:chunks|css)\/[A-Za-z0-9._-]+\.(?:js|css)/g;

// Warm the pages cache with the genuine HTML for a URL so future offline
// cold-loads hit a cached page (not the standalone /offline). Two callers: the
// client via SW_MSG_WARM_PAGE_CACHE after a successful note open, and
// ensurePrecached() for the required documents.
export async function cacheNavigationHtml(
  url: string,
  protectedPathnames: ReadonlySet<string>,
): Promise<void> {
  // Allowlist: note detail pages plus the precache set. `protectedPathnames`
  // IS that set, so the caller never has to pass it twice. Without the second
  // clause '/offline', '/notes' and '/todos' are unreachable for every warm
  // path — '/notes' has no trailing slash and fails the prefix test.
  if (!url.startsWith(NOTES_PATH_PREFIX) && !protectedPathnames.has(url)) {
    return;
  }

  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      redirect: 'follow',
      headers: {
        [SW_INTERNAL_HEADER]: '1',
        // Force the HTML response shape. Next.js inspects Accept to decide
        // between full HTML and RSC payload; a bare `fetch(url)` defaults to
        // Accept: */* and could land us on the RSC branch — which would store
        // RSC bytes under CACHE.pages and break offline cold-load rendering.
        Accept: 'text/html',
      },
    });
    if (!shouldCacheNavigation(response)) {
      return;
    }

    const htmlClone = response.clone();
    const cache = await caches.open(CACHE.pages);
    // await (not fire-and-forget like other strategies in this file) — we're
    // inside event.waitUntil from the message handler; SW lifetime must extend
    // until the put completes, else Chrome may terminate mid-write.
    await cache.put(url, response);
    await trimCache(CACHE.pages, PAGES_CACHE_MAX, protectedPathnames);
    const html = await htmlClone.text();
    await ensureStaticAssets(Array.from(new Set(html.match(STATIC_ASSET_RE) ?? [])));
  } catch {
    // Offline or network error — dropped here; ensurePrecached() reports the
    // remaining gap and the client retries on the next mount / online edge.
  }
}

/**
 * Cache every given build asset that isn't cached yet; returns how many are
 * still missing afterwards. That count IS the static half of PrecacheReport —
 * there is no second coverage calculation anywhere.
 *
 * Shared by both producers of asset URLs: the serwist build manifest
 * (swPrecache) and the asset references parsed out of a warmed HTML document.
 */
export async function ensureStaticAssets(urls: string[]): Promise<number> {
  if (urls.length === 0) {
    return 0;
  }

  const cache = await caches.open(CACHE.static);
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      // Hashed filenames are immutable — skip if already cached.
      if (await cache.match(url)) {
        return;
      }

      const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { [SW_INTERNAL_HEADER]: '1' },
      });
      if (!response.ok) {
        throw new Error(`${url}: ${String(response.status)}`);
      }

      await cache.put(url, response);
    }),
  );
  return results.filter((result) => result.status === 'rejected').length;
}
