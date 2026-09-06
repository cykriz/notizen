'use client';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { APPLY_LABEL, ASSIGN_TAGS_LABEL, FAILED_SYNC_TAG, pathHasReservedSegment } from '@/lib/constants';
import { Tags } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useData } from './dataContext';
import { TagInput } from './notes/[id]/TagInput';
import { useBatchTags } from './useBatchTags';
import type { NoteSelection } from './useNoteSelection';
import { listAllTags } from '@/lib/tagTree';
import type { SidebarView } from './viewStore';

interface AssignTagsPopoverProps {
  selection: NoteSelection;
  view: SidebarView;
  currentTagPath: string;
}

export function AssignTagsPopover({ selection, view, currentTagPath }: AssignTagsPopoverProps) {
  const { notes } = useData();
  const { applyTagDiff } = useBatchTags();
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const allTags = useMemo(() => listAllTags(notes), [notes]);

  // Base = the tags actually assigned to (shared by) the selected notes, per their
  // frontmatter — NOT the sidebar position. These are pre-filled so they can be kept
  // or removed (abwählen). In the tags view the browsed folder tag is always offered
  // too, so it works even on nested-tag notes. Synthetic/reserved tags are excluded.
  const baseTags = useMemo(() => {
    const selected = notes.filter((n) => selection.selectedIds.has(n.id));
    let shared = selected[0]?.tags.filter((t) => t !== FAILED_SYNC_TAG && !pathHasReservedSegment(t)) ?? [];
    shared = shared.filter((t) => selected.every((n) => n.tags.includes(t)));

    if (
      view === 'tags' &&
      currentTagPath !== '' &&
      !pathHasReservedSegment(currentTagPath) &&
      !shared.includes(currentTagPath)
    ) {
      shared = [currentTagPath, ...shared];
    }

    return shared;
  }, [notes, selection.selectedIds, view, currentTagPath]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setPendingTags(baseTags);
    }

    setOpen(next);
  };

  const handleApply = () => {
    const remove = baseTags.filter((t) => !pendingTags.includes(t));
    const add = pendingTags.filter((t) => !baseTags.includes(t));
    applyTagDiff([...selection.selectedIds], remove, add);
    setPendingTags([]);
    setOpen(false);
    selection.exitSelection();
  };

  // Enabled whenever the pending set differs from the assigned base (add or remove).
  const canApply =
    baseTags.some((t) => !pendingTags.includes(t)) || pendingTags.some((t) => !baseTags.includes(t));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button size="xs" variant="ghost" disabled={selection.selectedIds.size === 0} className="shrink-0">
          <Tags />
          {ASSIGN_TAGS_LABEL}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="flex w-64 flex-col gap-2 p-3">
        <TagInput
          tags={pendingTags}
          allTags={allTags}
          onChange={setPendingTags}
          compact
          className="w-full max-w-full"
        />
        <Button size="sm" onClick={handleApply} disabled={!canApply} className="self-end">
          {APPLY_LABEL}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
