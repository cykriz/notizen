// The single gate to localStorage for both persisted client preferences and the
// offline cache layer (localCache, localCacheMerge, failedSyncQueue, /login).
//
// Why it has to be a gate: Chrome with site data blocked throws a SecurityError
// on the mere `window.localStorage` property read — not only on getItem/setItem.
// A guard that reads that property before the try — the `typeof` form this repo
// used to carry — therefore invokes the very getter it was meant to protect and
// takes the page down. It looks correct because Firefox with
// dom.storage.enabled=false returns undefined instead, which is exactly one of
// the two cases. So every access, the bare property read included, lives inside
// the try below and callers get a fallback instead of an exception.

/**
 * Runs `op` against localStorage, answering `fallback` when it is unusable —
 * disabled storage (either flavour), a quota error, or a missing global.
 */
function withStore<T>(fallback: T, op: (store: Storage) => T): T {
  // `typeof window` is the SSR fast path and may sit outside the try: it cannot
  // throw. Reading the storage property could — hence the rule above.
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    return op(localStorage);
  } catch {
    return fallback;
  }
}

export function readLocal(key: string): string | null {
  return withStore(null, (store) => store.getItem(key));
}

/** Returns whether the value was stored — false on disabled or full storage. */
export function writeLocal(key: string, value: string): boolean {
  return withStore(false, (store) => {
    store.setItem(key, value);
    return true;
  });
}

/** Mirror of writeLocal, so a caller can report "nothing was persisted" for either. */
export function removeLocal(key: string): boolean {
  return withStore(false, (store) => {
    store.removeItem(key);
    return true;
  });
}

/**
 * Snapshot of all keys — a plain array rather than live `length`/`key(i)` access,
 * so callers can remove entries while iterating without shifting indices, and
 * need no null handling for a key that vanished mid-loop.
 */
export function localStorageKeys(): string[] {
  return withStore<string[]>([], (store) => {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key !== null) {
        keys.push(key);
      }
    }

    return keys;
  });
}

/** Read a persisted value, returning `fallback` unless it is one of `allowed`. */
export function readStoredOneOf<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const stored = readLocal(key);
  return allowed.includes(stored as T) ? (stored as T) : fallback;
}
