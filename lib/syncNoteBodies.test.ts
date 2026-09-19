import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { pullStaleNoteBodies, staleNoteBodyIds } from './syncNoteBodies';
import { SYNC_ACTION, SYNC_ENTITY } from './constants';
import { DRAFT_PREFIX, NOTE_PREFIX, SYNC_QUEUE_KEY } from './localCache';
import { FAILED_SYNC_KEY } from './failedSyncQueue';
import type { Note, NoteSummary } from './types';

// Bun exposes neither `localStorage` nor `window` — installed per test and
// removed afterwards, exactly as in localStorageState.test.ts, so a leaked
// global cannot follow into another test file.
let store: Map<string, string>;

function setGlobal(name: string, descriptor: PropertyDescriptor): void {
  Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
}

beforeEach(() => {
  store = new Map<string, string>();
  setGlobal('window', { value: {} });
  setGlobal('localStorage', {
    value: {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
  Reflect.deleteProperty(globalThis, 'window');
});

const AT = {
  old: '2026-01-01T10:00:00.000Z',
  new: '2026-01-02T10:00:00.000Z',
};

function summary(id: string, updatedAt: string): NoteSummary {
  return {
    id,
    slug: `slug-${id}`,
    title: `Notiz ${id}`,
    createdAt: AT.old,
    updatedAt,
    attachmentCount: 0,
    tags: [],
    pinned: false,
  };
}

function body(id: string, updatedAt: string, content: string): Note {
  return { ...summary(id, updatedAt), content, attachments: [] };
}

function cacheBody(note: Note): void {
  store.set(`${NOTE_PREFIX}${note.id}`, JSON.stringify(note));
}

function readCachedContent(id: string): string | undefined {
  const raw = store.get(`${NOTE_PREFIX}${id}`);
  return raw === undefined ? undefined : (JSON.parse(raw) as Note).content;
}

function queueEntry(key: string, entityId: string): void {
  store.set(
    key,
    JSON.stringify([
      {
        entityType: SYNC_ENTITY.NOTE,
        entityId,
        action: SYNC_ACTION.UPDATE,
        payload: { content: 'lokal' },
        timestamp: AT.new,
      },
    ]),
  );
}

describe('staleNoteBodyIds', () => {
  test('a cached body the server has a newer version of is stale', () => {
    cacheBody(body('n1', AT.old, 'alt'));
    expect(staleNoteBodyIds([summary('n1', AT.new)])).toEqual(['n1']);
  });

  test('an up-to-date body is not refetched', () => {
    cacheBody(body('n1', AT.new, 'aktuell'));
    expect(staleNoteBodyIds([summary('n1', AT.new)])).toEqual([]);
  });

  test('a note that was never opened has no body to refresh', () => {
    expect(staleNoteBodyIds([summary('n1', AT.new)])).toEqual([]);
  });

  test('a queued mutation means local wins — the body is left alone', () => {
    cacheBody(body('n1', AT.old, 'alt'));
    queueEntry(SYNC_QUEUE_KEY, 'n1');
    expect(staleNoteBodyIds([summary('n1', AT.new)])).toEqual([]);
  });

  test('a failed mutation is protected the same way', () => {
    cacheBody(body('n1', AT.old, 'alt'));
    queueEntry(FAILED_SYNC_KEY, 'n1');
    expect(staleNoteBodyIds([summary('n1', AT.new)])).toEqual([]);
  });

  test('an unsaved draft is protected too', () => {
    cacheBody(body('n1', AT.old, 'alt'));
    store.set(`${DRAFT_PREFIX}n1`, JSON.stringify({ title: 'T', content: 'getippt' }));
    expect(staleNoteBodyIds([summary('n1', AT.new)])).toEqual([]);
  });
});

describe('pullStaleNoteBodies', () => {
  test('replaces the stale body and reports the id', async () => {
    cacheBody(body('n1', AT.old, 'alt'));
    const result = await pullStaleNoteBodies([summary('n1', AT.new)], (id) =>
      Promise.resolve(body(id, AT.new, 'vom Server')),
    );

    expect(result).toEqual({ replaced: ['n1'], failed: 0 });
    expect(readCachedContent('n1')).toBe('vom Server');
  });

  test('one failing note does not stop the others', async () => {
    cacheBody(body('n1', AT.old, 'alt'));
    cacheBody(body('n2', AT.old, 'alt'));
    const result = await pullStaleNoteBodies(
      [summary('n1', AT.new), summary('n2', AT.new)],
      (id) => (id === 'n1' ? Promise.reject(new Error('offline')) : Promise.resolve(body(id, AT.new, 'neu'))),
    );

    expect(result).toEqual({ replaced: ['n2'], failed: 1 });
    expect(readCachedContent('n1')).toBe('alt');
    expect(readCachedContent('n2')).toBe('neu');
  });

  test('an unreadable answer leaves the cache untouched', async () => {
    cacheBody(body('n1', AT.old, 'alt'));
    const result = await pullStaleNoteBodies([summary('n1', AT.new)], () =>
      Promise.resolve('<html>Login</html>'),
    );

    expect(result).toEqual({ replaced: [], failed: 1 });
    expect(readCachedContent('n1')).toBe('alt');
  });

  test('a body answering under a different id never overwrites this one', async () => {
    cacheBody(body('n1', AT.old, 'alt'));
    const result = await pullStaleNoteBodies([summary('n1', AT.new)], () =>
      Promise.resolve(body('n9', AT.new, 'fremd')),
    );

    expect(result).toEqual({ replaced: [], failed: 1 });
    expect(readCachedContent('n1')).toBe('alt');
  });

  test('a fetch that could not read the note is simply skipped', async () => {
    cacheBody(body('n1', AT.old, 'alt'));
    const result = await pullStaleNoteBodies([summary('n1', AT.new)], () => Promise.resolve(null));

    expect(result).toEqual({ replaced: [], failed: 1 });
    expect(readCachedContent('n1')).toBe('alt');
  });

  // Nine notes against a limit of four: proves the pool drains its backlog
  // instead of dropping whatever did not fit the first wave.
  test('every stale note is pulled even beyond the concurrency limit', async () => {
    const summaries = Array.from({ length: 9 }, (_, i) => summary(`n${i.toString()}`, AT.new));
    for (const s of summaries) {
      cacheBody(body(s.id, AT.old, 'alt'));
    }

    let inFlight = 0;
    let peak = 0;
    const result = await pullStaleNoteBodies(summaries, async (id) => {
      peak = Math.max(peak, ++inFlight);
      await Promise.resolve();
      inFlight--;
      return body(id, AT.new, 'neu');
    });

    expect(result.replaced.toSorted()).toEqual(summaries.map((s) => s.id).toSorted());
    expect(result.failed).toBe(0);
    expect(peak).toBeLessThanOrEqual(4);
  });
});
