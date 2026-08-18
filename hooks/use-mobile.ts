import * as React from 'react';

// Tailwind's `lg` (1024px, not overridden in app/globals.css). Exactly two CSS sites spell this
// boundary as `lg:` and cannot be changed apart from it: MobileBottomNav's visibility and
// CommandPalette's mobile anchoring. The note editor's mobile-only chrome (NoteHeader,
// NoteActionsMenu, MarkdownEditorToolbar, NoteListItem) still switches at `md:` — an older, second
// threshold that this number deliberately does not claim to cover.
const MOBILE_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => {
      mql.removeEventListener('change', onChange);
    };
  }, []);

  return isMobile === true;
}
