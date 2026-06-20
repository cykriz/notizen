import { SW_INTERNAL_HEADER } from '@/lib/constants';
import { CACHE, PAGES_CACHE_MAX, shouldCacheNavigation, trimCache } from './swStrategies';

// Matches `/_next/static/chunks/<hash>.js` and `/_next/static/css/<hash>.css`
// references in the cached HTML. We warm all of them into the static cache so
// a future offline cold-load can hydrate without missing chunks.
const STATIC_ASSET_RE = /\/_next\/static\/(?:chunks|css)\/[A-Za-z0-9._-]+\.(?:js|css)/g;

// Warm pages-v2 with the genuine HTML for a /notes/<id> URL so future offline
// cold-loads hit a cached page (not the standalone /offline). Triggered by the
// client via SW_MSG_WARM_PAGE_CACHE after a successful note open.
export async function cacheNavigationHtml(
  url: string,
  protectedPathnames: ReadonlySet<string>,
): Promise<void> {
  if (!url.startsWith('/notes/')) return;
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      redirect: 'follow',
      headers: {
        [SW_INTERNAL_HEADER]: '1',
        // Force the HTML response shape. Next.js inspects Accept to decide
        // between full HTML and RSC payload; a bare `fetch(url)` defaults to
        // Accept: */* and could land us on the RSC branch — which would store
        // RSC bytes under pages-v2 and break offline cold-load rendering.
        Accept: 'text/html',
      },
    });
    if (!shouldCacheNavigation(response)) return;
    const htmlClone = response.clone();
    const cache = await caches.open(CACHE.pages);
    // await (not fire-and-forget like other strategies in this file) — we're
    // inside event.waitUntil from the message handler; SW lifetime must extend
    // until the put completes, else Chrome may terminate mid-write.
    await cache.put(url, response);
    await trimCache(CACHE.pages, PAGES_CACHE_MAX, protectedPathnames);
    const html = await htmlClone.text();
    await warmStaticAssets(html);
  } catch {
    // Offline or network error — silently drop; client retries on next load.
  }
}

async function warmStaticAssets(html: string): Promise<void> {
  const urls = Array.from(new Set(html.match(STATIC_ASSET_RE) ?? []));
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
      if (!response.ok) return;
      await cache.put(url, response);
    }),
  );
}
