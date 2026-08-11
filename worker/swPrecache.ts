import type { PrecacheReport } from '@/lib/types';
import { SW_PRECACHE_PATHS } from '@/lib/pathConstants';
import { CACHE } from './swStrategies';
import { cacheNavigationHtml, ensureStaticAssets } from './swWarm';

declare const self: ServiceWorkerGlobalScope;

export const STATIC_ASSET_PREFIX = '/_next/static/';

// Pathnames protected from FIFO eviction in the pages cache. Frozen so the
// strategies module can take it as ReadonlySet without copying.
export const PROTECTED_PAGE_PATHS: ReadonlySet<string> = new Set<string>(SW_PRECACHE_PATHS);

// EVERY build asset under /_next/static, from the manifest serwist injects at
// build time (esbuild define on `self.__SW_MANIFEST`). This covers
// dynamically-imported chunks (next/dynamic, e.g. MarkdownPreview) that never
// appear in any page's HTML and so can't be warmed by HTML parsing — without
// them an offline cold-load of a note hits ChunkLoadError. Manifest excludes
// files > 2 MiB.
function manifestUrls(): string[] {
  return (self.__SW_MANIFEST ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry.url))
    .filter((url) => url.startsWith(STATIC_ASSET_PREFIX));
}

async function missingPagePaths(): Promise<string[]> {
  // Scoped to CACHE.pages rather than a global caches.match: a leftover cache
  // from an older build would otherwise mask a gap in the current one.
  const cache = await caches.open(CACHE.pages);
  const missing: string[] = [];
  for (const path of SW_PRECACHE_PATHS) {
    if (!(await cache.match(path))) {
      missing.push(path);
    }
  }
  return missing;
}

async function missingStaticUrls(): Promise<string[]> {
  const urls = manifestUrls();
  if (urls.length === 0) return [];
  const cache = await caches.open(CACHE.static);
  // cache.keys() yields absolute request URLs while the manifest holds
  // root-relative paths — compare on pathname, the same normalisation trimCache
  // uses. Without it nothing ever matches and the full manifest would be
  // re-fetched on every check.
  const present = new Set((await cache.keys()).map((key) => new URL(key.url).pathname));
  return urls.filter((url) => !present.has(url));
}

let inFlight: Promise<PrecacheReport> | null = null;

/**
 * Verify the precache and refill only what's missing, then report what still
 * is. Idempotent and cheap when healthy (one cache.match per required page +
 * one cache.keys for the static cache), so callers may run it on every mount
 * and every online transition.
 *
 * Concurrent callers (several tabs, online flapping) share one run; the slot is
 * released when it settles, so a later call always re-checks instead of
 * replaying a frozen report.
 */
export function ensurePrecached(): Promise<PrecacheReport> {
  if (inFlight !== null) return inFlight;
  const run = runEnsure().finally(() => {
    inFlight = null;
  });
  inFlight = run;
  return run;
}

async function runEnsure(): Promise<PrecacheReport> {
  const [pageGaps, staticGaps] = await Promise.all([missingPagePaths(), missingStaticUrls()]);
  if (pageGaps.length === 0 && staticGaps.length === 0) {
    return { missingPages: [], missingStatic: 0 };
  }

  const [, missingStatic] = await Promise.all([
    // allSettled: one unreachable document must not abandon the others.
    Promise.allSettled(pageGaps.map((path) => cacheNavigationHtml(path, PROTECTED_PAGE_PATHS))),
    ensureStaticAssets(staticGaps),
  ]);

  return { missingPages: await missingPagePaths(), missingStatic };
}
