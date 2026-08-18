'use client';

import { Plus, FolderPlus, Tags, List, ListChecks, Trash2, ArrowLeft } from 'lucide-react';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';
import { SHORTCUT } from '@/lib/globalShortcuts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SidebarFooter } from '@/components/ui/sidebar';
import {
  CANCEL_LABEL,
  NEW_FOLDER_LABEL,
  PAPIERKORB_LABEL,
  SELECT_NOTES_LABEL,
  SELECTED_COUNT_SUFFIX,
  TRASH_CLOSE_LABEL,
  VIEW_ALL_LABEL,
  VIEW_TAGS_LABEL,
} from '@/lib/constants';
import { AssignTagsPopover } from './AssignTagsPopover';
import { TrashOffIcon } from './TrashOffIcon';
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
  // No ref dance around `pending` any more: useGlobalShortcut reads the handler through a ref of
  // its own, so this closure is always the current render's.
  useGlobalShortcut(SHORTCUT.CREATE, () => {
    // No note creation while browsing the trash.
    if (!pending && viewStore.getSnapshot() !== 'trash') {
      handleCreate();
    }
  });

  // Selection mode: hide the browse controls; show the count, the tag action and
  // a back arrow to leave.
  if (selection.selectionMode) {
    return (
      <SidebarFooter>
        <div className="flex items-center gap-1">
          <span className="sidebar-label text-muted-foreground">
            {selection.selectedIds.size} {SELECTED_COUNT_SUFFIX}
          </span>
          <AssignTagsPopover selection={selection} view={view} currentTagPath={currentTagPath} />
          <Button size="icon-xs" variant="ghost" onClick={selection.exitSelection} title={CANCEL_LABEL}>
            <ArrowLeft />
          </Button>
        </div>
      </SidebarFooter>
    );
  }

  return (
    <SidebarFooter>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCreate}
          disabled={pending || view === 'trash'}
          className="flex-1 justify-start"
        >
          <Plus />
          Neue Notiz
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onCreateFolder}
          disabled={pending || view === 'trash'}
          title={NEW_FOLDER_LABEL}
        >
          <FolderPlus />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => {
            viewStore.set(view === 'tags' ? 'all' : 'tags');
          }}
          disabled={view === 'trash'}
          title={view === 'tags' ? VIEW_ALL_LABEL : VIEW_TAGS_LABEL}
        >
          {view === 'tags' ? <List /> : <Tags />}
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          className="group"
          onClick={() => {
            viewStore.toggleTrash();
          }}
          title={view === 'trash' ? TRASH_CLOSE_LABEL : PAPIERKORB_LABEL}
        >
          {view === 'trash' ? <TrashOffIcon /> : <Trash2 />}
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
          disabled={view === 'trash'}
          title={SELECT_NOTES_LABEL}
          className={cn({ 'bg-accent': selection.selectionMode })}
        >
          <ListChecks />
        </Button>
      </div>
    </SidebarFooter>
  );
}
