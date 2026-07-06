'use client';

export type SidebarView = 'tags' | 'all' | 'trash';
const STORAGE_KEY = 'notes-sidebar-view';

export const viewStore = (() => {
  const listeners = new Set<() => void>();
  let snapshot: SidebarView = (() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'all' || stored === 'trash' ? stored : 'tags';
    }

    return 'tags';
  })();

  // Remembers the last non-trash view so toggling the trash off returns there.
  let lastListView: SidebarView = snapshot === 'trash' ? 'tags' : snapshot;

  const subscribe = (cb: () => void) => {
    listeners.add(cb);

    return () => {
      listeners.delete(cb);
    };
  };

  const getSnapshot = (): SidebarView => snapshot;

  const getServerSnapshot = (): SidebarView => 'tags';

  const set = (v: SidebarView) => {
    if (v !== 'trash') {
      lastListView = v;
    }

    snapshot = v;
    localStorage.setItem(STORAGE_KEY, v);
    for (const cb of listeners) {
      cb();
    }
  };

  // Enter the trash from a notes view, or return to the previous notes view.
  const toggleTrash = () => {
    set(snapshot === 'trash' ? lastListView : 'trash');
  };

  return { subscribe, getSnapshot, getServerSnapshot, set, toggleTrash };
})();
