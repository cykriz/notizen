// Safe localStorage access for persisted client preferences. Guards SSR (no
// window) and access errors (private mode / disabled storage) so callers can
// use it directly in state initialisers and effects.

export function readLocal(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore storage quota / availability errors */
  }
}

/** Read a persisted value, returning `fallback` unless it is one of `allowed`. */
export function readStoredOneOf<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const stored = readLocal(key);
  return allowed.includes(stored as T) ? (stored as T) : fallback;
}
