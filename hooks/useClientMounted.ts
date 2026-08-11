import { useSyncExternalStore } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
const emptySubscribe = () => noop;

/**
 * Returns true only on the client after hydration, false during SSR.
 *
 * ## The rule this exists for
 *
 * Nothing derived from `localStorage`, the clock or `next-themes` may reach the
 * **hydration render**. That render happens on the client, so "client-side only" is
 * not the same as "safe" — the trap that produced React #418 here more than once.
 * It re-renders the tree React is trying to match against the server HTML, and any
 * element it adds, removes or re-tags throws a hydration mismatch. `useState`
 * initializers and `useMemo` bodies both run in it; only effects do not.
 *
 * Two shapes satisfy the rule, and the choice is not stylistic:
 *
 * - **Derived value** — gate it on this hook, which returns the SSR value during
 *   hydration via `getServerSnapshot`. Use this whenever the value is recomputed
 *   from the external source on every render (`useFailedEntityIds`, `TodoCard`'s
 *   overdue badge, `useColorMode`).
 * - **State the user can later own** — seed it SSR-neutral and correct it in a mount
 *   effect, because a gate would keep overwriting the user's own value
 *   (`useDataSync`'s queue counts, `NoteEditor`'s preview mode).
 *
 * Sites implementing either shape point here rather than restating this.
 */
export function useClientMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
