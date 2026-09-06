'use client';

import { readStoredOneOf, writeLocal } from '@/lib/localStorageState';

// The array is the source of the exported type, so both can never drift apart —
// and readStoredOneOf takes it as the allowlist for the persisted value.
const VIEWS = ['tags', 'all', 'trash'] as const;
export type SidebarView = (typeof VIEWS)[number];
const STORAGE_KEY = 'notes-sidebar-view';

export const viewStore = (() => {
  const listeners = new Set<() => void>();
  // Guarded read: this runs at module evaluation, so an unguarded
  // localStorage access would throw on import with storage disabled.
  let snapshot: SidebarView = readStoredOneOf(STORAGE_KEY, VIEWS, 'tags');

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
    writeLocal(STORAGE_KEY, v);
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
