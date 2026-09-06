/**
 * Every global Mod+<key> shortcut the app claims, in one place. The values are the normalised
 * combos `comboOf` builds from an event: the key lower-cased, prefixed with `shift+` when Shift is
 * held. Bind them with `useGlobalShortcut`, never with a `keydown` listener of your own.
 */
export const SHORTCUT = {
  PALETTE: 'p',
  CREATE: 'n',
  SIDEBAR: 'b',
  VIEW_NOTES: '1',
  VIEW_TODOS: '2',
  PREVIEW: 'o',
  OUTLINE: 'shift+o',
} as const;

export type ShortcutCombo = (typeof SHORTCUT)[keyof typeof SHORTCUT];

type ShortcutHandler = () => void;

/** The fields `comboOf` reads — a real KeyboardEvent satisfies it, and so can a test. */
interface ShortcutKeys {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
}

const handlers = new Map<string, Set<ShortcutHandler>>();
let listening = false;

/** null for every event that cannot be one of our combos. Exported for lib/globalShortcuts.test.ts. */
export function comboOf(e: ShortcutKeys): string | null {
  // Alt is excluded rather than ignored: AltGr reports ctrl+alt on Windows/Linux, and claiming
  // those in the capture phase would swallow the typed character before the input ever sees it.
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.isComposing) {
    return null;
  }

  return `${e.shiftKey ? 'shift+' : ''}${e.key.toLowerCase()}`;
}

// Capture phase, and that is the whole point. cmdk and CodeMirror both leave a key alone once its
// default is prevented (cmdk's `if (!(e.defaultPrevented || isComposing))`, CodeMirror's
// `if (event.defaultPrevented) break` in runHandlers), so claiming a combo here — before the event
// reaches either — is what stops them from acting on it as well. In the bubble phase `window` came
// last: Ctrl+P closed the palette *and* moved its selection (cmdk reads it as "up"), and on macOS
// Mod+O toggled the preview *and* split a line in the editor. `stopPropagation` would work too, but
// on `window` it is a far bigger hammer — it would also cut Radix's document-level dismiss handling.
function handleKeyDown(e: KeyboardEvent) {
  const combo = comboOf(e);
  const bound = combo === null ? undefined : handlers.get(combo);
  if (bound === undefined || bound.size === 0) {
    // Unclaimed combos stay the browser's — Ctrl+O still opens a file on pages without an editor.
    return;
  }

  e.preventDefault();
  // Over a copy: a handler may unregister itself, or a sibling, while it runs.
  for (const handler of [...bound]) {
    handler();
  }
}

/**
 * Binds `handler` to a global shortcut and returns the disposer.
 *
 * The one window listener is installed on the first call and then stays — shortcuts come and go
 * with their components, the listener does not. A combo only has an owner from the moment it is
 * registered, so anything that has to survive a page load must be registered from a statically
 * imported component: see `app/(app)/CommandPaletteClient.tsx`.
 *
 * A combo may have more than one owner and then every handler runs, in registration order. That is
 * deliberate but only safe while the owners are mutually exclusive — `SHORTCUT.CREATE` is bound by
 * `NotesSidebarFooter` and by `TodoBoard`, and the notes footer unmounts on /todos, which is
 * the only page the matrix lives on. Two owners that *can* coexist would both fire, silently; give
 * them separate combos instead.
 */
export function registerShortcut(combo: ShortcutCombo, handler: ShortcutHandler): () => void {
  // Client modules are evaluated in the server render too; nothing to bind there.
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if (!listening) {
    window.addEventListener('keydown', handleKeyDown, true);
    listening = true;
  }

  const bound = handlers.get(combo) ?? new Set<ShortcutHandler>();
  bound.add(handler);
  handlers.set(combo, bound);

  return () => {
    bound.delete(handler);
  };
}
