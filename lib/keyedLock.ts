// The one serialization primitive for filesystem writes. Three copies of this
// chain used to live in fsHelpers.ts (notes, todos) and fsSharesRegistry.ts
// (shares). In-process only — it does not protect against multi-process races.

/**
 * Returns a lock whose calls are serialized per key; different keys run
 * concurrently. The chain survives a rejected `fn`, and an idle key is dropped
 * from the map so it cannot leak.
 */
export function createKeyedLock() {
  const locks = new Map<string, Promise<unknown>>();

  return async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = locks.get(key) ?? Promise.resolve();
    // Reuse `fn` as both onFulfilled/onRejected so the chain survives a prior failure.
    const current = prev.then(fn, fn);
    locks.set(key, current);
    try {
      return await current;
    } finally {
      if (locks.get(key) === current) {
        locks.delete(key);
      }
    }
  };
}
