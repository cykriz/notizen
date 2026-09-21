/**
 * A mirror of AppSidebar's `folderParent` — the tag folder the sidebar is currently browsing.
 *
 * The owner stays `useTagStateSync`; this store only publishes its value so the command palette
 * can read it. The palette hangs beside the sidebar under a server layout, so there is no shared
 * provider and no route or search param the folder could be derived from — the same sibling
 * problem `paletteStore` documents. A store rather than lifting the state: `useTagStateSync`
 * adjusts its state during render, which is legal for useState but not for a store write, and a
 * provider above `{children}` would re-render the whole (app) tree on every folder click.
 *
 * Only AppSidebar calls `set`; everyone else reads.
 */
const INITIAL = '';

export const currentFolderStore = (() => {
  const listeners = new Set<() => void>();
  // A bare string, not an object: useSyncExternalStore compares with Object.is, so a read
  // never hands out a fresh identity.
  let snapshot: string = INITIAL;

  const subscribe = (cb: () => void) => {
    listeners.add(cb);

    return () => {
      listeners.delete(cb);
    };
  };

  const getSnapshot = (): string => snapshot;

  const getServerSnapshot = (): string => INITIAL;

  const set = (path: string) => {
    if (path === snapshot) {
      return;
    }

    snapshot = path;
    for (const cb of listeners) {
      cb();
    }
  };

  return { subscribe, getSnapshot, getServerSnapshot, set };
})();

/** The tags a note created inside folder `path` carries — root ('') means: no tag at all. */
export const folderTags = (path: string): string[] => (path === '' ? [] : [path]);
