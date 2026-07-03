'use client';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { APPLY_LABEL, ASSIGN_TAGS_LABEL, pathHasReservedSegment } from '@/lib/constants';
import { Tags } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useData } from './dataContext';
import { TagInput } from './notes/[id]/TagInput';
import { useBatchTags } from './useBatchTags';
import type { NoteSelection } from './useNoteSelection';
import type { SidebarView } from './viewStore';

interface AssignTagsPopoverProps {
  selection: NoteSelection;
  view: SidebarView;
  currentTagPath: string;
}

export function AssignTagsPopover({ selection, view, currentTagPath }: AssignTagsPopoverProps) {
  const { notes } = useData();
  const { applyFolderTag } = useBatchTags();
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const allTags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);

  // In the tags view the browsed folder tag is pre-filled so it can be kept,
  // replaced, or removed (abwählen). The synthetic sync-fehler folder is excluded.
  const currentFolderTag =
    view === 'tags' && currentTagPath !== '' && !pathHasReservedSegment(currentTagPath) ? currentTagPath : null;

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setPendingTags(currentFolderTag !== null ? [currentFolderTag] : []);
    }

    setOpen(next);
  };

  const handleApply = () => {
    // tags view: replace the browsed-folder tag; all view: pure add (from='')
    const from = view === 'tags' ? currentTagPath : '';
    applyFolderTag([...selection.selectedIds], from, pendingTags);
    setPendingTags([]);
    setOpen(false);
    selection.exitSelection();
  };

  // In a folder, applying an empty list removes that folder tag, so allow it there.
  const canApply = currentFolderTag !== null || pendingTags.length > 0;

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
