import type { Page } from '@playwright/test';
import { NOTES_LIST_KEY, SYNC_QUEUE_KEY, TODOS_KEY, type SyncQueueEntry } from '../../lib/localCache';
import { FAILED_SYNC_KEY } from '../../lib/failedSyncQueue';

// Direct localStorage access for the sync queues and caches, its own module
// because four callers share it. Seeding beats driving the UI
// through multi-cycle offline navigation, which stresses service-worker chunk
// caching rather than the feature under test.

/** page.evaluate runs in the browser and cannot close over module scope, so every
 *  key is passed in as an argument. */
async function readKey<T>(page: Page, key: string): Promise<T[]> {
  return (await page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw !== null ? (JSON.parse(raw) as unknown[]) : [];
  }, key)) as T[];
}

/** Read the failed-sync queue (notizen:sync-failed). */
export async function readFailedQueue(page: Page): Promise<SyncQueueEntry[]> {
  return await readKey<SyncQueueEntry>(page, FAILED_SYNC_KEY);
}

/** Read the pending sync queue (notizen:sync-queue). */
export async function readPendingQueue(page: Page): Promise<SyncQueueEntry[]> {
  return await readKey<SyncQueueEntry>(page, SYNC_QUEUE_KEY);
}

/** Write failed-queue entries directly. */
export async function seedFailedQueue(
  page: Page,
  entries: Partial<SyncQueueEntry>[],
): Promise<void> {
  await page.evaluate(({ key, seed }) => {
    const full = seed.map((e) => ({
      entityType: 'note',
      action: 'update',
      payload: {},
      timestamp: new Date().toISOString(),
      retryCount: 5,
      ...e,
    }));
    localStorage.setItem(key, JSON.stringify(full));
  }, { key: FAILED_SYNC_KEY, seed: entries });
}

/** Write pending-queue entries directly. */
export async function seedPendingQueue(
  page: Page,
  entries: Partial<SyncQueueEntry>[],
): Promise<void> {
  await page.evaluate(({ key, seed }) => {
    const full = seed.map((e) => ({
      entityType: 'todo',
      action: 'create',
      payload: {},
      timestamp: new Date().toISOString(),
      ...e,
    }));
    localStorage.setItem(key, JSON.stringify(full));
  }, { key: SYNC_QUEUE_KEY, seed: entries });
}

/** Read the cached note list (notizen:notes-list). */
export async function readCachedNotes(page: Page): Promise<Record<string, unknown>[]> {
  return await readKey<Record<string, unknown>>(page, NOTES_LIST_KEY);
}

/** Read the cached todo list (notizen:todos). */
export async function readCachedTodos(page: Page): Promise<Record<string, unknown>[]> {
  return await readKey<Record<string, unknown>>(page, TODOS_KEY);
}

/** Write the cached todo list directly — used to seed malformed or legacy rows. */
export async function seedCachedTodos(
  page: Page,
  rows: Record<string, unknown>[],
): Promise<void> {
  await page.evaluate(({ key, rows: r }) => {
    localStorage.setItem(key, JSON.stringify(r));
  }, { key: TODOS_KEY, rows });
}

/** Force every pending entry's retryCount so the next drain gives up on it. */
export async function setRetryCount(page: Page, retryCount: number): Promise<void> {
  await page.evaluate(({ key, count }) => {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return;
    }

    const queue = JSON.parse(raw) as { retryCount?: number }[];
    for (const entry of queue) {
      entry.retryCount = count;
    }
    localStorage.setItem(key, JSON.stringify(queue));
  }, { key: SYNC_QUEUE_KEY, count: retryCount });
}

/** Drop every notizen: key so a test starts from a clean client state. */
export async function clearLocalState(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('notizen:') === true) {
        localStorage.removeItem(key);
      }
    }
  });
}
