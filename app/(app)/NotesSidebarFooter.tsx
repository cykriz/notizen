'use client';

import { useEffect, useRef } from 'react';
import { Plus, FolderPlus, Tags, List, ListChecks, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SidebarFooter } from '@/components/ui/sidebar';
import { CANCEL_LABEL, NEW_FOLDER_LABEL, SELECT_NOTES_LABEL, SELECTED_COUNT_SUFFIX } from '@/lib/constants';
import { AssignTagsPopover } from './AssignTagsPopover';
import type { NoteSelection } from './useNoteSelection';
import { viewStore, type SidebarView } from './viewStore';

interface NotesSidebarFooterProps {
  view: SidebarView;
  handleCreate: () => void;
  onCreateFolder: () => void;
  pending: boolean;
  selection: NoteSelection;
  currentTagPath: string;
}

export function NotesSidebarFooter({
  view,
  handleCreate,
  onCreateFolder,
  pending,
  selection,
  currentTagPath,
}: NotesSidebarFooterProps) {
  const pendingRef = useRef(pending);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!pendingRef.current) {
          handleCreate();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCreate]);

  return (
    <SidebarFooter>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={handleCreate} disabled={pending} className="flex-1 justify-start">
          <Plus />
          Neue Notiz
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onCreateFolder}
          disabled={pending}
          title={NEW_FOLDER_LABEL}
        >
          <FolderPlus />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => {
            viewStore.set('tags');
          }}
          className={cn({ 'bg-accent': view === 'tags' })}
        >
          <Tags />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => {
            viewStore.set('all');
          }}
          className={cn({ 'bg-accent': view === 'all' })}
        >
          <List />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => {
            if (selection.selectionMode) {
              selection.exitSelection();
            } else {
              selection.enterSelection();
            }
          }}
          title={SELECT_NOTES_LABEL}
          className={cn({ 'bg-accent': selection.selectionMode })}
        >
          <ListChecks />
        </Button>
      </div>

      {selection.selectionMode && (
        <div className="flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground">
            {selection.selectedIds.size} {SELECTED_COUNT_SUFFIX}
          </span>
          <AssignTagsPopover selection={selection} view={view} currentTagPath={currentTagPath} />
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={selection.exitSelection}
            title={CANCEL_LABEL}
            className="shrink-0"
          >
            <X />
          </Button>
        </div>
      )}
    </SidebarFooter>
  );
}
