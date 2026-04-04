'use client';

export type SidebarView = 'tags' | 'all';
const STORAGE_KEY = 'notes-sidebar-view';

export const viewStore = (() => {
  const listeners = new Set<() => void>();
  let snapshot: SidebarView = (() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'all' ? 'all' : 'tags';
    }

    return 'tags';
  })();

  const subscribe = (cb: () => void) => {
    listeners.add(cb);

    return () => {
      listeners.delete(cb);
    };
  };

  const getSnapshot = (): SidebarView => snapshot;

  const getServerSnapshot = (): SidebarView => 'tags';

  const set = (v: SidebarView) => {
    snapshot = v;
    localStorage.setItem(STORAGE_KEY, v);
    for (const cb of listeners) {
      cb();
    }
  };

  return { subscribe, getSnapshot, getServerSnapshot, set };
})();
