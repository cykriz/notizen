'use client';

import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { FAILED_SYNC_TAG, NOTE_DRAG_MIME, NOTE_IDS_DRAG_MIME, pathHasReservedSegment } from '@/lib/constants';
import type { TagNode } from '@/lib/tagTree';
import type { NoteSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { FailedSyncDialog } from './FailedSyncDialog';
import { TagBreadcrumb } from './TagBreadcrumb';
import { TagFolderIcon } from './TagFolderIcon';
import { useBatchTags } from './useBatchTags';

interface TagNavigationProps {
  notes: NoteSummary[];
  // The folders at currentPath. Derived in AppSidebar, because whether this panel
  // renders at all also decides whether the block above it draws a separator —
  // one predicate, one place.
  childNodes: TagNode[];
  currentPath: string;
  setCurrentPath: (path: string) => void;
  onFolderDeleted: () => void;
  exitSelection?: () => void;
}

export function TagNavigation({ notes, childNodes, currentPath, setCurrentPath, onFolderDeleted, exitSelection }: TagNavigationProps) {
  const { applyFolderTag } = useBatchTags();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [failedSyncOpen, setFailedSyncOpen] = useState(false);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
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

  if (childNodes.length === 0 && currentPath === '') {
    return failedSyncDialog;
  }

  return (
    // Eigene Fläche für den Navigationsteil: das ist die Grenze, die zählt — Container
    // gegen Notiz. `bg-background` statt `bg-sidebar-accent`, weil letzteres exakt der
    // Hover-Ton der Zeilen ist und den Hover verschlucken würde; so wächst der
    // Hover-Kontrast stattdessen, weil die Zeilen von einer entfernteren Fläche starten.
    //
    // Der Ring trägt die Grenze im Light-Theme, wo die Füllung allein nicht reicht:
    // --background 1.0 gegen --sidebar 0.985 sind 1,5% Helligkeit. `ring` statt `border`,
    // weil ein Ring keine Box-Breite kostet — die Breadcrumb-Zeile darunter ist auf jedes
    // Pixel angewiesen, um tiefe Pfade unabgeschnitten zu zeigen.
    <div
      className="flex max-h-[calc(0.5*var(--app-h))] flex-col gap-1 overflow-y-auto rounded-lg bg-background p-1 ring-1 ring-sidebar-border"
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

      {childNodes.length > 0 && (
        <SidebarMenu>
          {childNodes.map((node) => (
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
                <TagFolderIcon />
                <span className="truncate">{node.segment}</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{node.noteCount}</SidebarMenuBadge>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      )}

      {failedSyncDialog}
    </div>
  );
}
