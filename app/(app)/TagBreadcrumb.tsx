'use client';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FAILED_SYNC_OPEN_LABEL } from '@/lib/failedSyncConstants';
import {
  TAG_BREADCRUMB_TO_ROOT_LABEL,
  TAG_BREADCRUMB_UP_LABEL,
  TAG_FOLDER_DELETE_LABEL,
  TAG_ROOT_LABEL,
  tagBreadcrumbJumpLabel,
} from '@/lib/tagConstants';
import { ancestorTagPaths, leafTagSegment } from '@/lib/tagTree';
import { ChevronLeft, ChevronsLeft, CloudAlert, Folder, Trash2 } from 'lucide-react';
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
 * and a readable folder name at once, so the path lives entirely in the back button —
 * as its menu, or one level below root as the jump the button makes itself — and the
 * name gets the whole row.
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
  // The path whose menu is open, not a bare flag: the path also moves without the user
  // (useTagStateSync re-targets it when a sync alters the open note's tags), and a value
  // left over from the old path can never match the new one, so a menu whose folder is
  // gone cannot reappear by itself.
  const [openFor, setOpenFor] = useState('');
  const ancestors = ancestorTagPaths(currentPath);
  // One level below root, the menu would hold a single row — a click in front of the
  // click. The button jumps there itself instead, and the chevrons say which it is:
  // one for the one step, two for a choice of several.
  const hasMenu = ancestors.length > 0;
  const upLabel = hasMenu ? TAG_BREADCRUMB_UP_LABEL : TAG_BREADCRUMB_TO_ROOT_LABEL;

  const jumpTo = (path: string) => {
    setCurrentPath(path);
    setOpenFor('');
  };

  // The same jump the menu's root row makes — one level below root the button *is* that
  // row, so the two must not be able to drift apart.
  const jumpToRoot = () => {
    jumpTo('');
  };

  const upButton = (
    <Button
      variant="ghost"
      size="icon-xs"
      // icon-xs carries its own enlarged hit area below md — see button.tsx. The open
      // highlight rides on Radix's data-state, which only a popover trigger ever carries,
      // so the direct-jump form needs no open state of its own to stay unhighlighted.
      className="shrink-0 data-[state=open]:bg-accent"
      aria-label={upLabel}
      title={upLabel}
      // Only the direct jump handles its own click; in the menu form the click belongs to
      // PopoverTrigger, which composes its handler onto this element.
      onClick={hasMenu ? undefined : jumpToRoot}
    >
      {hasMenu ? <ChevronsLeft /> : <ChevronLeft />}
    </Button>
  );

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-sidebar-foreground/70">
      {hasMenu ? (
        <Popover
          open={openFor === currentPath}
          onOpenChange={(open) => {
            setOpenFor(open ? currentPath : '');
          }}
        >
          <PopoverTrigger asChild>{upButton}</PopoverTrigger>
          {/* Tag paths are free-form, so this list has no natural length limit. Radix can
              flip or shift the popover to fit but never scroll it, so without the cap the
              deepest ancestors of a very deep path fall off the screen unreachably. */}
          <PopoverContent
            align="start"
            className="flex max-h-(--radix-popover-content-available-height) w-56 flex-col gap-1 overflow-y-auto p-1"
          >
            {/* Path order, so the menu reads like the path: root first, direct parent last. */}
            <PathMenuRow label={TAG_ROOT_LABEL} onSelect={jumpToRoot} />
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
      ) : (
        upButton
      )}

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
