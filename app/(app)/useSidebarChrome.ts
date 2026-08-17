'use client';

import { useMemo } from 'react';
import { buildTagTree, getChildNodes, type TagNode } from '@/lib/tagTree';
import type { NoteSummary } from '@/lib/types';

interface UseSidebarChromeParams {
  // Un-augmented notes for the pinned rows; displayNotes (with the synthetic
  // sync-fehler tag) for the tag tree, so that folder shows up in the navigator.
  notes: NoteSummary[];
  displayNotes: NoteSummary[];
  currentTagPath: string;
  // The notes sidebar in tag mode — the only place the navigator can appear.
  tagView: boolean;
}

/**
 * Derives what the sidebar's upper blocks look like, split out of AppSidebar for
 * the 200-line cap.
 *
 * Both lists live here rather than inside the components that render them,
 * because their emptiness decides more than their own visibility: the tag
 * navigator is a ringed panel and carries the boundary to whatever sits above
 * it, so the block directly above drops its separator instead of doubling the
 * border — and which block that is depends on the pinned group being there.
 * A second copy of either predicate would silently double or drop that line as
 * soon as one of them is touched.
 *
 * `hasTagNav` therefore mirrors TagNavigation's own render condition exactly:
 * folders to show, or a path whose breadcrumb it holds.
 */
export function useSidebarChrome({
  notes,
  displayNotes,
  currentTagPath,
  tagView,
}: UseSidebarChromeParams): {
  pinnedNotes: NoteSummary[];
  tagChildren: TagNode[];
  hasTagNav: boolean;
} {
  const pinnedNotes = useMemo(() => notes.filter((n) => n.pinned), [notes]);
  const tagChildren = useMemo(
    () => getChildNodes(buildTagTree(displayNotes), currentTagPath),
    [displayNotes, currentTagPath],
  );

  return {
    pinnedNotes,
    tagChildren,
    hasTagNav: tagView && (tagChildren.length > 0 || currentTagPath !== ''),
  };
}
