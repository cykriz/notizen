'use client';

import { Button } from '@/components/ui/button';
import { FAILED_SYNC_OPEN_LABEL } from '@/lib/failedSyncConstants';
import { ChevronLeft, CloudAlert, Trash2 } from 'lucide-react';
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

  const handleBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  return (
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
  );
}
