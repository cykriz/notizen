'use client';

import { useMemo } from 'react';
import type { NoteSummary } from '@/lib/types';

/** The one pinned predicate — shared by the sidebar group and the `/notes` overview so both
 *  always list the same notes in the same order (the list's own updatedAt order). */
export function usePinnedNotes(notes: NoteSummary[]): NoteSummary[] {
  return useMemo(() => notes.filter((n) => n.pinned), [notes]);
}
