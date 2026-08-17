'use client';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FAILED_SYNC_OPEN_LABEL } from '@/lib/failedSyncConstants';
import {
  TAG_BREADCRUMB_UP_LABEL,
  TAG_FOLDER_DELETE_LABEL,
  TAG_ROOT_LABEL,
  tagBreadcrumbJumpLabel,
} from '@/lib/tagConstants';
import { ancestorTagPaths, leafTagSegment } from '@/lib/tagTree';
import { cn } from '@/lib/utils';
import { ChevronLeft, CloudAlert, Folder, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DeleteTagFolderDialog } from './DeleteTagFolderDialog';

interface TagBreadcrumbProps {
  currentPath: string;
  setCurrentPath: (path: string) => void;
  // True for the synthetic sync-fehler folder, which gets an inspector button
  // instead of a delete button — its notes are not really tagged.
  isFailedSyncTag: boolean;
  onOpenFailedSync: () => void;
  onFolderDeleted: () => void;
  deleteOpen: boolean;
  setDeleteOpen: (open: boolean) => void;
}

/**
 * The current folder's name plus its actions. A 16rem sidebar cannot hold the path
 * and a readable folder name at once, so the path lives entirely in the back
 * button's menu and the name gets the whole row.
 */
export function TagBreadcrumb({
  currentPath,
  setCurrentPath,
  isFailedSyncTag,
  onOpenFailedSync,
  onFolderDeleted,
  deleteOpen,
  setDeleteOpen,
}: TagBreadcrumbProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ancestors = ancestorTagPaths(currentPath);

  const jumpTo = (path: string) => {
    setCurrentPath(path);
    setMenuOpen(false);
  };

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-sidebar-foreground/70">
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            // icon-xs carries its own enlarged hit area below md — see button.tsx.
            className={cn('shrink-0', { 'bg-accent': menuOpen })}
            aria-label={TAG_BREADCRUMB_UP_LABEL}
            title={TAG_BREADCRUMB_UP_LABEL}
          >
            <ChevronLeft />
          </Button>
        </PopoverTrigger>
        {/* Tag paths are free-form, so this list has no natural length limit. Radix can
            flip or shift the popover to fit but never scroll it, so without the cap the
            deepest ancestors of a very deep path fall off the screen unreachably. */}
        <PopoverContent
          align="start"
          className="flex max-h-(--radix-popover-content-available-height) w-56 flex-col gap-1 overflow-y-auto p-1"
        >
          {/* Path order, so the menu reads like the path: root first, direct parent last. */}
          <PathMenuRow
            label={TAG_ROOT_LABEL}
            onSelect={() => {
              jumpTo('');
            }}
          />
          {ancestors.map((ancestor, i) => (
            <PathMenuRow
              key={ancestor.path}
              label={ancestor.segment}
              depth={i + 1}
              // Two ancestors of one path can share a segment name; the full path
              // in the tooltip is what tells them apart.
              title={tagBreadcrumbJumpLabel(ancestor.path)}
              onSelect={() => {
                jumpTo(ancestor.path);
              }}
            />
          ))}
        </PopoverContent>
      </Popover>

      {/* The full path is the tooltip, since the row itself no longer shows it. */}
      <span className="sidebar-label font-medium text-sidebar-foreground" title={currentPath}>
        {leafTagSegment(currentPath)}
      </span>

      {isFailedSyncTag ? (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onOpenFailedSync}
          className="shrink-0 text-destructive hover:text-destructive"
          title={FAILED_SYNC_OPEN_LABEL}
        >
          <CloudAlert />
        </Button>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              setDeleteOpen(true);
            }}
            className="shrink-0 text-destructive hover:text-destructive"
            title={TAG_FOLDER_DELETE_LABEL}
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
  );
}

// One small step per level, so the rows read as a tree without pushing the deep ones
// off the popover. Spelled out rather than computed: Tailwind scans source text, so a
// class built from a variable is never generated. Deeper paths keep the last step.
const INDENT_BY_DEPTH = ['ml-0', 'ml-2', 'ml-4', 'ml-6', 'ml-8'] as const;

/** One jump target in the path menu, indented by how deep its folder sits. */
function PathMenuRow({
  label,
  title,
  depth = 0,
  onSelect,
}: {
  label: string;
  title?: string;
  depth?: number;
  onSelect: () => void;
}) {
  // The indent rides on the icon, not on the button's padding: `has-[>svg]:px-2` from
  // the size variant has :has() specificity and would outrank a plain pl-* here.
  const indent = INDENT_BY_DEPTH[Math.min(depth, INDENT_BY_DEPTH.length - 1)];

  return (
    // Touch height comes from .menu-row, so both popover menus agree on it.
    <Button variant="ghost" className="menu-row" title={title} onClick={onSelect}>
      {/* Neutrales Outline-Icon, nicht das gefüllte TagFolderIcon der Navigationszeilen:
          dieses Menü listet ausschließlich Ordner, und der Indent trägt hier die
          Information. Getönte Füllung auf jeder Zeile wäre nur Gewicht ohne Aussage. */}
      <Folder className={indent} />
      <span className="truncate">{label}</span>
    </Button>
  );
}
