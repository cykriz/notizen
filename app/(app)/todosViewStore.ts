'use client';

import { readStoredOneOf, writeLocal } from '@/lib/localStorageState';

// Array first, type derived from it — see app/(app)/viewStore.ts for the rationale.
const VIEWS = ['overview', 'trash'] as const;
export type TodosView = (typeof VIEWS)[number];
const STORAGE_KEY = 'todos-sidebar-view';

export const todosViewStore = (() => {
  const listeners = new Set<() => void>();
  // Guarded read: this runs at module evaluation, so an unguarded
  // localStorage access would throw on import with storage disabled.
  let snapshot: TodosView = readStoredOneOf(STORAGE_KEY, VIEWS, 'overview');

  const subscribe = (cb: () => void) => {
    listeners.add(cb);

    return () => {
      listeners.delete(cb);
    };
  };

  const getSnapshot = (): TodosView => snapshot;

  const getServerSnapshot = (): TodosView => 'overview';

  const set = (v: TodosView) => {
    snapshot = v;
    writeLocal(STORAGE_KEY, v);
    for (const cb of listeners) {
      cb();
    }
  };

  return { subscribe, getSnapshot, getServerSnapshot, set };
})();
