'use client';

import { Button } from '@/components/ui/button';
import { FAILED_SYNC_OPEN_LABEL } from '@/lib/failedSyncConstants';
import { TAG_FOLDER_DELETE_LABEL, tagBreadcrumbJumpLabel } from '@/lib/tagConstants';
import { parentTagPath } from '@/lib/tagTree';
import { ChevronLeft, CloudAlert, Ellipsis, Trash2 } from 'lucide-react';
import { DeleteTagFolderDialog } from './DeleteTagFolderDialog';

// A 16rem sidebar fits roughly two readable segments beside the back and delete
// buttons, and that cost stays constant however deep the path is. Deeper paths
// collapse their prefix into one "…" button that walks up to the deepest hidden
// ancestor — repeatedly, if the path is deeper than four.
const MAX_VISIBLE_SEGMENTS = 2;

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

/** Back button + clickable path segments + the folder's trailing action. */
export function TagBreadcrumb({
  currentPath,
  setCurrentPath,
  isFailedSyncTag,
  onOpenFailedSync,
  onFolderDeleted,
  deleteOpen,
  setDeleteOpen,
}: TagBreadcrumbProps) {
  const pathSegments = currentPath.split('/');
  const hiddenCount = Math.max(0, pathSegments.length - MAX_VISIBLE_SEGMENTS);
  const hiddenPath = pathSegments.slice(0, hiddenCount).join('/');

  const handleBack = () => {
    setCurrentPath(parentTagPath(currentPath));
  };

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-sidebar-foreground/70">
      <Button variant="ghost" size="icon-xs" onClick={handleBack} className="shrink-0">
        <ChevronLeft />
      </Button>
      {hiddenCount > 0 && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            setCurrentPath(hiddenPath);
          }}
          className="shrink-0"
          title={tagBreadcrumbJumpLabel(hiddenPath)}
        >
          <Ellipsis />
        </Button>
      )}
      {pathSegments.slice(hiddenCount).map((seg, i) => {
        // Keyed on the cumulative prefix, not the index: index 0 means a different
        // folder before and after the prefix collapses.
        const segmentPath = pathSegments.slice(0, hiddenCount + i + 1).join('/');
        return (
          <span key={segmentPath} className="flex min-w-0 items-center gap-0.5">
            {(i > 0 || hiddenCount > 0) && <span className="shrink-0">/</span>}
            {/* No max-width: flexbox hands the shortfall to the longest segments, so
                the row fits at any depth without a cap leaving space unused. */}
            <Button
              variant="link"
              size="xs"
              shrinkable
              onClick={() => {
                setCurrentPath(segmentPath);
              }}
              className="h-auto px-1 py-2"
              title={seg}
            >
              <span className="truncate">{seg}</span>
            </Button>
          </span>
        );
      })}
      {isFailedSyncTag ? (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onOpenFailedSync}
          className="ml-auto shrink-0 text-destructive hover:text-destructive"
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
            className="ml-auto shrink-0 text-destructive hover:text-destructive"
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
