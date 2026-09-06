import { test, expect, type Page } from '@playwright/test';
import { OFFLINE_PATH, SW_MSG_ENSURE_PRECACHE } from '../../lib/constants';
import { TODO_COLUMN_META } from '../../lib/todoColumns';
import { NOTES_PATH, NOTES_PATH_PREFIX, SW_PRECACHE_PATHS, TODOS_PATH } from '../../lib/pathConstants';
import { goOffline, watchForHydrationErrors } from './helpers';

// A note id that certainly has no cached HTML of its own — an offline
// navigation here is exactly the reported production symptom.
const UNKNOWN_NOTE_ID = '8f14e45f-ceea-467a-9c2f-1f2f3e4d5a6b';

const ALL_PRECACHED = [...SW_PRECACHE_PATHS];

/** Resolve once the SW is installed and activated for this page. */
async function swReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}

/**
 * Reproduce the state a deploy leaves behind: SW installed and active, but its
 * build-versioned pages cache empty. Done AFTER install on purpose — in e2e the
 * install-time precache succeeds (the storageState cookie is present), so
 * breaking it up front would test a different thing. With the SW left
 * registered, only the repair path can refill the cache.
 */
async function wipePagesCache(page: Page): Promise<string[]> {
  return await page.evaluate(async () => {
    const removed: string[] = [];
    for (const name of await caches.keys()) {
      if (name.startsWith('pages-')) {
        await caches.delete(name);
        removed.push(name);
      }
    }
    return removed;
  });
}

/** Which required documents the fallback chain would find (global, like caches.match in the SW). */
async function cachedPaths(page: Page, paths: readonly string[]): Promise<string[]> {
  return await page.evaluate(async (candidates) => {
    const hits: string[] = [];
    for (const path of candidates) {
      if (await caches.match(path)) {
        hits.push(path);
      }
    }
    return hits;
  }, [...paths]);
}

interface PrecacheReportShape {
  missingPages: string[];
  missingStatic: number;
}

/** Ask the SW for its own precache report over the same MessageChannel the app uses. */
async function requestPrecacheReport(page: Page): Promise<PrecacheReportShape | null> {
  return await page.evaluate(async (messageType) => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (!worker) {
      return null;
    }

    return await new Promise<PrecacheReportShape | null>((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        resolve(null);
      }, 60_000);
      channel.port1.onmessage = (event: MessageEvent<PrecacheReportShape | null>) => {
        clearTimeout(timer);
        resolve(event.data);
      };
      worker.postMessage({ type: messageType }, [channel.port2]);
    });
  }, SW_MSG_ENSURE_PRECACHE);
}

/** Load /notes online and wait until the SW reports a complete precache again. */
async function loadAndAwaitRepair(page: Page): Promise<void> {
  await page.goto(NOTES_PATH);
  await expect
    .poll(() => cachedPaths(page, SW_PRECACHE_PATHS), { timeout: 40_000 })
    .toEqual(ALL_PRECACHED);
}

test.describe('Service-Worker-Precache', () => {
  let hydrationErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    hydrationErrors = watchForHydrationErrors(page);
    await page.goto(NOTES_PATH);
    await swReady(page);
    // Baseline: with a valid session the install-time precache does succeed.
    // Without this the later assertions could pass on a cache that was never
    // populated in the first place.
    await expect
      .poll(() => cachedPaths(page, SW_PRECACHE_PATHS), { timeout: 40_000 })
      .toEqual(ALL_PRECACHED);

    // Drain: ensurePrecached shares one in-flight run, so awaiting a report here
    // also awaits the repair this mount may still be running. Any later call
    // then finds a complete cache and writes nothing — which is what makes the
    // wipe below reproducible instead of racing an idle-deferred write.
    const baseline = await requestPrecacheReport(page);
    expect(baseline?.missingPages).toEqual([]);
  });

  test.afterEach(() => {
    expect(hydrationErrors).toEqual([]);
  });

  test('ein geleerter pages-Cache wird beim nächsten Online-Mount wieder aufgefüllt', async ({
    page,
  }) => {
    // Leave the (app) tree before breaking things: /offline mounts no
    // DataProvider, so nothing can schedule a write between wipe and assertion.
    await page.goto(OFFLINE_PATH);
    const removed = await wipePagesCache(page);
    // Guards against a green run on a cache that was never actually broken.
    expect(removed.length).toBeGreaterThan(0);
    expect(await cachedPaths(page, SW_PRECACHE_PATHS)).toEqual([]);

    // One online visit is all the repair gets: the (app) tree mounts and asks
    // the SW to check itself. Discriminating entries are /todos and /offline —
    // /notes is re-cached by the navigation itself and the note shell is warmed
    // by DataProvider even without the fix.
    await loadAndAwaitRepair(page);

    const report = await requestPrecacheReport(page);
    expect(report).not.toBeNull();
    expect(report?.missingPages).toEqual([]);
    expect(report?.missingStatic).toBe(0);
  });

  test('offline lädt die App auch nach einem geleerten Cache statt des 503-Notnagels', async ({
    page,
  }) => {
    // Same reason as above: break the cache from outside the (app) tree.
    await page.goto(OFFLINE_PATH);
    await wipePagesCache(page);

    // Setup assertion, not a fix discriminator: proves the wipe really produces
    // the reported production state (503 sw=true, the inline last-resort HTML).
    await goOffline(page);
    const brokenState = await page.goto(`${NOTES_PATH_PREFIX}${UNKNOWN_NOTE_ID}`);
    expect(brokenState?.status()).toBe(503);

    // Raw setOffline instead of goOnline(): the document currently loaded is the
    // SW's static 503 page, so there is no app running to observe the health check.
    await page.context().setOffline(false);
    await loadAndAwaitRepair(page);
    await goOffline(page);

    // /todos was never visited in this test — before the fix nothing can put it
    // into the cache, because cacheNavigationHtml drops every non-/notes/ URL.
    const todos = await page.goto(TODOS_PATH);
    expect(todos?.status()).toBe(200);
    await expect(page.getByText(TODO_COLUMN_META[0].label, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });

    // The reported symptom itself: a note whose own HTML was never cached.
    const unknownNote = await page.goto(`${NOTES_PATH_PREFIX}${UNKNOWN_NOTE_ID}`);
    expect(unknownNote?.status()).toBe(200);
  });

  test('nach dem Abmelden bleibt /offline im Cache, die Nutzerseiten nicht', async ({ page }) => {
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });

    // The SW does the purge inside waitUntil, so poll for the end state.
    // /notes, /todos and the shell all embed the user's server-rendered list;
    // /offline is public and has no user data, so it is the one entry kept.
    await expect
      .poll(() => cachedPaths(page, SW_PRECACHE_PATHS), { timeout: 20_000 })
      .toEqual([OFFLINE_PATH]);

    await page.context().setOffline(true);
    const offline = await page.goto(NOTES_PATH);
    // 200 = the themed /offline page from the cache; 503 = the inline fallback.
    // The status is the only reliable discriminator — both carry identical German copy.
    expect(offline?.status()).toBe(200);
    expect(await page.locator('script[src*="/_next/static/"]').count()).toBeGreaterThan(0);
  });
});
