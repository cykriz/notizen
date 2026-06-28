'use client';

import { Button } from '@/components/ui/button';
import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { FAILED_SYNC_TAG, NOTE_DRAG_MIME, pathHasReservedSegment } from '@/lib/constants';
import { buildTagTree, getChildNodes, moveNoteToFolder } from '@/lib/tagTree';
import type { NoteSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, Folder, Tag, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ClearFailedSyncDialog } from './ClearFailedSyncDialog';
import { useData } from './dataContext';
import { DeleteTagFolderDialog } from './DeleteTagFolderDialog';

interface TagNavigationProps {
  notes: NoteSummary[];
  currentPath: string;
  setCurrentPath: (path: string) => void;
  onFolderDeleted: () => void;
}

export function TagNavigation({ notes, currentPath, setCurrentPath, onFolderDeleted }: TagNavigationProps) {
  const { updateNote } = useData();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clearFailedOpen, setClearFailedOpen] = useState(false);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const tree = useMemo(() => buildTagTree(notes), [notes]);
  const children = useMemo(() => getChildNodes(tree, currentPath), [tree, currentPath]);
  const hasNotesAtLevel = useMemo(
    () =>
      currentPath === '' ? notes.some((n) => n.tags.length === 0) : notes.some((n) => n.tags.includes(currentPath)),
    [notes, currentPath],
  );
  const pathSegments = currentPath !== '' ? currentPath.split('/') : [];
  const isFailedSyncTag = currentPath === FAILED_SYNC_TAG;

  // Auto-pop when the synthetic sync-fehler folder vanishes via a background
  // retry that cleared the last failed entry. The dialog flow already calls
  // setCurrentPath('') from onCleared, so this only fires for the silent path.
  useEffect(() => {
    if (isFailedSyncTag && !notes.some((n) => n.tags.includes(FAILED_SYNC_TAG))) {
      setCurrentPath('');
    }
  }, [isFailedSyncTag, notes, setCurrentPath]);

  const handleBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

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
    const noteId = e.dataTransfer.getData(NOTE_DRAG_MIME);
    const note = notes.find((n) => n.id === noteId);
    const next = note ? moveNoteToFolder(note.tags, currentPath, target) : null;
    if (!next) {
      return;
    }

    void updateNote(noteId, { tags: next }).catch(() => {
      // Network error — retried on the next sync
    });
  };

  if (children.length === 0 && currentPath === '') {
    return null;
  }

  return (
    <div
      className="flex max-h-[calc(0.5*var(--app-h))] flex-col gap-1 overflow-y-auto"
      onDragLeave={handleContainerDragLeave}
    >
      {currentPath !== '' && (
        <div className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-sidebar-foreground/70">
          <Button variant="ghost" size="icon-xs" onClick={handleBack} className="shrink-0">
            <ChevronLeft />
          </Button>
          {pathSegments.map((seg, i) => (
            <span key={i} className="flex min-w-0 items-center gap-0.5">
              {i > 0 && <span className="shrink-0">/</span>}
              <Button
                variant="link"
                size="xs"
                onClick={() => {
                  setCurrentPath(pathSegments.slice(0, i + 1).join('/'));
                }}
                className="min-w-0 overflow-hidden max-w-24 py-2 h-auto"
              >
                <span className="truncate">{seg}</span>
              </Button>
            </span>
          ))}
          {isFailedSyncTag ? (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setClearFailedOpen(true);
                }}
                className="ml-auto shrink-0 text-destructive hover:text-destructive"
                title="Fehlgeschlagene Synchronisierungen löschen"
              >
                <Trash2 />
              </Button>
              <ClearFailedSyncDialog
                open={clearFailedOpen}
                onOpenChange={setClearFailedOpen}
                onCleared={() => {
                  setCurrentPath('');
                }}
              />
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setDeleteOpen(true);
                }}
                className="ml-auto shrink-0 text-destructive hover:text-destructive"
                title="Ordner löschen"
              >
                <Trash2 />
              </Button>
              <DeleteTagFolderDialog
                path={currentPath}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onDeleted={onFolderDeleted}
              />
            </>
          )}
        </div>
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
    </div>
  );
}
