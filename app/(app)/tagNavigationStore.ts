interface TagNavigationSnapshot {
  path: string;
  version: number;
}

const INITIAL: TagNavigationSnapshot = { path: '', version: 0 };

export const tagNavigationStore = (() => {
  const listeners = new Set<() => void>();
  let snapshot: TagNavigationSnapshot = INITIAL;

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };

  const getSnapshot = (): TagNavigationSnapshot => snapshot;

  const getServerSnapshot = (): TagNavigationSnapshot => INITIAL;

  const navigateTo = (path: string) => {
    snapshot = { path, version: snapshot.version + 1 };
    for (const cb of listeners) {
      cb();
    }
  };

  return { subscribe, getSnapshot, getServerSnapshot, navigateTo };
})();
