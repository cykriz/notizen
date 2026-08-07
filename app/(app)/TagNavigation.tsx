'use client';

import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { FAILED_SYNC_TAG, NOTE_DRAG_MIME, NOTE_IDS_DRAG_MIME, pathHasReservedSegment } from '@/lib/constants';
import { buildTagTree, getChildNodes } from '@/lib/tagTree';
import type { NoteSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Folder, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FailedSyncDialog } from './FailedSyncDialog';
import { TagBreadcrumb } from './TagBreadcrumb';
import { useBatchTags } from './useBatchTags';

interface TagNavigationProps {
  notes: NoteSummary[];
  currentPath: string;
  setCurrentPath: (path: string) => void;
  onFolderDeleted: () => void;
  exitSelection?: () => void;
}

export function TagNavigation({ notes, currentPath, setCurrentPath, onFolderDeleted, exitSelection }: TagNavigationProps) {
  const { applyFolderTag } = useBatchTags();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [failedSyncOpen, setFailedSyncOpen] = useState(false);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const tree = useMemo(() => buildTagTree(notes), [notes]);
  const children = useMemo(() => getChildNodes(tree, currentPath), [tree, currentPath]);
  const hasNotesAtLevel = useMemo(
    () =>
      currentPath === '' ? notes.some((n) => n.tags.length === 0) : notes.some((n) => n.tags.includes(currentPath)),
    [notes, currentPath],
  );
  const isFailedSyncTag = currentPath === FAILED_SYNC_TAG;

  // Auto-pop when the synthetic sync-fehler folder vanishes via a background
  // retry that cleared the last failed entry. The dialog flow already calls
  // setCurrentPath('') from onEmptied, so this only fires for the silent path.
  useEffect(() => {
    if (isFailedSyncTag && !notes.some((n) => n.tags.includes(FAILED_SYNC_TAG))) {
      setCurrentPath('');
    }
  }, [isFailedSyncTag, notes, setCurrentPath]);

  const handleDragOverFolder = (e: React.DragEvent, path: string) => {
    if (!e.dataTransfer.types.includes(NOTE_DRAG_MIME) || pathHasReservedSegment(path)) {
      // Non-droppable target (wrong payload or reserved folder) — drop any
      // highlight left over from a previously-hovered valid folder.
      setDragOverPath(null);
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPath(path);
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    // dragleave bubbles — ignore moves between children, only clear on actual exit
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) {
      return;
    }

    setDragOverPath(null);
  };

  const handleDropOnFolder = (e: React.DragEvent, target: string) => {
    e.preventDefault();
    setDragOverPath(null);
    const multi = e.dataTransfer.getData(NOTE_IDS_DRAG_MIME);
    const ids = multi !== '' ? (JSON.parse(multi) as string[]) : [e.dataTransfer.getData(NOTE_DRAG_MIME)];
    applyFolderTag(ids, currentPath, [target]);
    if (multi !== '') {
      // Only leave selection mode after a real batch drop — dragging a single
      // unselected note in selection mode keeps the in-progress selection.
      exitSelection?.();
    }
  };

  // Kept outside every conditional below. onEmptied resets the path AND the last
  // sync-fehler folder disappears in the same commit, so both the breadcrumb
  // branch and the "nothing to navigate" early return would tear the dialog down
  // the instant the list empties — no close animation, and the user never sees
  // the "all transferred" state the dialog deliberately stays open to show.
  const failedSyncDialog = (
    <FailedSyncDialog
      open={failedSyncOpen}
      onOpenChange={setFailedSyncOpen}
      onEmptied={() => {
        setCurrentPath('');
      }}
    />
  );

  if (children.length === 0 && currentPath === '') {
    return failedSyncDialog;
  }

  return (
    <div
      className="flex max-h-[calc(0.5*var(--app-h))] flex-col gap-1 overflow-y-auto"
      onDragLeave={handleContainerDragLeave}
    >
      {currentPath !== '' && (
        <TagBreadcrumb
          currentPath={currentPath}
          setCurrentPath={setCurrentPath}
          isFailedSyncTag={isFailedSyncTag}
          onOpenFailedSync={() => {
            setFailedSyncOpen(true);
          }}
          onFolderDeleted={onFolderDeleted}
          deleteOpen={deleteOpen}
          setDeleteOpen={setDeleteOpen}
        />
      )}

      {children.length > 0 && (
        <SidebarMenu>
          {children.map((node) => (
            <SidebarMenuItem key={node.fullPath}>
              <SidebarMenuButton
                onClick={() => {
                  setCurrentPath(node.fullPath);
                }}
                onDragOver={(e) => {
                  handleDragOverFolder(e, node.fullPath);
                }}
                onDrop={(e) => {
                  handleDropOnFolder(e, node.fullPath);
                }}
                className={cn('h-auto', {
                  'bg-primary/10 ring-2 ring-inset ring-primary/60': dragOverPath === node.fullPath,
                })}
              >
                {node.children.length > 0 ? <Folder className="shrink-0" /> : <Tag className="shrink-0" />}
                <span className="truncate">{node.segment}</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{node.noteCount}</SidebarMenuBadge>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      )}

      {hasNotesAtLevel && children.length > 0 && <SidebarSeparator />}

      {failedSyncDialog}
    </div>
  );
}
