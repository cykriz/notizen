import { afterEach, describe, expect, test } from 'bun:test';

import { localStorageKeys, readLocal, readStoredOneOf, removeLocal, writeLocal } from './localStorageState';

// Bun exposes neither `localStorage` nor `window`, so both are installed per test
// and removed afterwards — a leaked global would follow into the other test files.

function setGlobal(name: string, descriptor: PropertyDescriptor): void {
  Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
}

function clearGlobal(name: string): void {
  Reflect.deleteProperty(globalThis, name);
}

/** Chrome with site data blocked: the property read itself throws. */
function installThrowingStorage(): void {
  setGlobal('window', { value: {} });
  setGlobal('localStorage', {
    get() {
      throw new DOMException('storage disabled', 'SecurityError');
    },
  });
}

/** Firefox with dom.storage.enabled=false: the property is simply absent. */
function installMissingStorage(): void {
  setGlobal('window', { value: {} });
  setGlobal('localStorage', { value: undefined });
}

function installWorkingStorage(): Map<string, string> {
  const entries = new Map<string, string>();
  setGlobal('window', { value: {} });
  setGlobal('localStorage', {
    value: {
      get length() {
        return entries.size;
      },
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
      removeItem: (key: string) => {
        entries.delete(key);
      },
      key: (index: number) => [...entries.keys()][index] ?? null,
      clear: () => {
        entries.clear();
      },
    },
  });

  return entries;
}

afterEach(() => {
  clearGlobal('localStorage');
  clearGlobal('window');
});

describe('with a throwing localStorage getter', () => {
  test('the shim is hostile — the bare property read throws', () => {
    installThrowingStorage();
    // Guards the negative control: without this, the tests below would pass
    // against a storage that never throws in the first place.
    expect(() => localStorage.length).toThrow('storage disabled');
  });

  test('readLocal answers null instead of throwing', () => {
    installThrowingStorage();
    expect(readLocal('notizen:notes-list')).toBeNull();
  });

  test('writeLocal answers false instead of throwing', () => {
    installThrowingStorage();
    expect(writeLocal('notizen:notes-list', '[]')).toBe(false);
  });

  test('removeLocal answers false instead of throwing', () => {
    installThrowingStorage();
    expect(removeLocal('notizen:notes-list')).toBe(false);
  });

  test('localStorageKeys answers an empty list instead of throwing', () => {
    installThrowingStorage();
    expect(localStorageKeys()).toEqual([]);
  });

  test('readStoredOneOf answers the fallback instead of throwing', () => {
    installThrowingStorage();
    expect(readStoredOneOf('notes-sidebar-view', ['tags', 'all', 'trash'] as const, 'tags')).toBe('tags');
  });
});

describe('with localStorage absent (Firefox, storage disabled)', () => {
  test('every operation answers its fallback', () => {
    installMissingStorage();
    expect(readLocal('k')).toBeNull();
    expect(writeLocal('k', 'v')).toBe(false);
    expect(removeLocal('k')).toBe(false);
    expect(localStorageKeys()).toEqual([]);
    expect(readStoredOneOf('k', ['a', 'b'] as const, 'b')).toBe('b');
  });
});

describe('with working storage', () => {
  test('writeLocal / readLocal round-trip and report success', () => {
    installWorkingStorage();
    expect(writeLocal('notizen:draft:1', '{"title":"T"}')).toBe(true);
    expect(readLocal('notizen:draft:1')).toBe('{"title":"T"}');
    expect(readLocal('notizen:draft:2')).toBeNull();
  });

  test('removeLocal deletes the entry and reports success', () => {
    const entries = installWorkingStorage();
    writeLocal('notizen:note:1', '{}');
    expect(removeLocal('notizen:note:1')).toBe(true);
    expect(readLocal('notizen:note:1')).toBeNull();
    expect(entries.size).toBe(0);
    // Removing what is not there is still a completed removal.
    expect(removeLocal('notizen:note:1')).toBe(true);
  });

  test('localStorageKeys lists every key', () => {
    installWorkingStorage();
    writeLocal('notizen:notes-list', '[]');
    writeLocal('theme', 'dark');
    expect(localStorageKeys()).toEqual(['notizen:notes-list', 'theme']);
  });

  test('localStorageKeys is a snapshot — removing while iterating skips nothing', () => {
    installWorkingStorage();
    writeLocal('notizen:a', '1');
    writeLocal('notizen:b', '2');
    writeLocal('notizen:c', '3');
    const seen: string[] = [];
    for (const key of localStorageKeys()) {
      seen.push(key);
      removeLocal(key);
    }

    expect(seen).toEqual(['notizen:a', 'notizen:b', 'notizen:c']);
    expect(localStorageKeys()).toEqual([]);
  });

  test('readStoredOneOf keeps an allowed value and rejects anything else', () => {
    installWorkingStorage();
    writeLocal('notes-sidebar-view', 'trash');
    expect(readStoredOneOf('notes-sidebar-view', ['tags', 'all', 'trash'] as const, 'tags')).toBe('trash');
    writeLocal('notes-sidebar-view', 'quadrants');
    expect(readStoredOneOf('notes-sidebar-view', ['tags', 'all', 'trash'] as const, 'tags')).toBe('tags');
  });
});

describe('without a window (server render)', () => {
  test('the fast path answers fallbacks even though storage would work', () => {
    const entries = installWorkingStorage();
    entries.set('notizen:notes-list', '[]');
    clearGlobal('window');
    expect(readLocal('notizen:notes-list')).toBeNull();
    expect(writeLocal('notizen:notes-list', '[]')).toBe(false);
    expect(localStorageKeys()).toEqual([]);
  });
});
