'use client';

/**
 * `open` of the command palette, as a store rather than component state: the Mod+P owner
 * (`CommandPaletteClient`) and the mobile trigger (`MobileBottomNav`) are siblings under the
 * layout's server component, which can hold no state for them to share.
 *
 * Deliberately not built on a shared `createExternalStore<T>` even though this is the fifth
 * hand-written listener skeleton in `app/(app)`: only subscribe/notify would be common, while every
 * other store's `set` does something of its own — localStorage in `viewStore`/`todosViewStore`, a
 * version bump in `tagNavigationStore`, an async refresh in `sharedNotesStore`.
 */
export const paletteStore = (() => {
  const listeners = new Set<() => void>();
  let open = false;

  const set = (next: boolean) => {
    open = next;
    for (const cb of listeners) {
      cb();
    }
  };

  const subscribe = (cb: () => void) => {
    listeners.add(cb);

    return () => {
      listeners.delete(cb);
    };
  };

  return {
    subscribe,
    getSnapshot: () => open,
    getServerSnapshot: () => false,
    set,
    toggle: () => {
      set(!open);
    },
  };
})();
