'use client';

export type TodosView = 'overview' | 'trash';
const STORAGE_KEY = 'todos-sidebar-view';

export const todosViewStore = (() => {
  const listeners = new Set<() => void>();
  let snapshot: TodosView = (() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'trash' ? 'trash' : 'overview';
    }

    return 'overview';
  })();

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
    localStorage.setItem(STORAGE_KEY, v);
    for (const cb of listeners) {
      cb();
    }
  };

  return { subscribe, getSnapshot, getServerSnapshot, set };
})();
