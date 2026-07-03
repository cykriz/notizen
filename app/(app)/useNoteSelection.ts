'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface NoteSelection {
  selectionMode: boolean;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  enterSelection: () => void;
  exitSelection: () => void; // clears the selection AND leaves the mode
}

// Transient (non-persisted) multi-select state for the notes sidebar. Lives in
// AppSidebar and is threaded down via the `selection` prop; survives a tags<->all
// view switch so "select then switch view to assign tags" works.
export function useNoteSelection(): NoteSelection {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  const enterSelection = useCallback(() => {
    setSelectionMode(true);
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Esc leaves selection mode — but let an open popover/dialog consume Escape
  // first (so the first Esc closes the popover, a second Esc exits selection).
  useEffect(() => {
    if (!selectionMode) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) {
        return;
      }

      if (document.querySelector('[data-slot="popover-content"], [role="dialog"]') !== null) {
        return;
      }

      exitSelection();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectionMode, exitSelection]);

  // Stable reference while nothing selection-related changed, so the memoized
  // NoteListItem rows don't all re-render on every unrelated AppSidebar render.
  return useMemo(
    () => ({ selectionMode, selectedIds, toggleSelected, enterSelection, exitSelection }),
    [selectionMode, selectedIds, toggleSelected, enterSelection, exitSelection],
  );
}
