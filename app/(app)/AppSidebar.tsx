'use client';

import { Sidebar, useSidebar } from '@/components/ui/sidebar';
import { useFinePointer } from '@/hooks/useFinePointer';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { FAILED_SYNC_TAG, SYNC_ENTITY } from '@/lib/constants';
import { getInspectableEntries } from '@/lib/failedSyncQueue';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppSidebarBody } from './AppSidebarBody';
import { AppSidebarHeader } from './AppSidebarHeader';
import { CreateTagFolderDialog } from './CreateTagFolderDialog';
import { useData } from './dataContext';
import { withFailedSyncTag } from './failedSyncTag';
import { isTabActive } from './navTabs';
import { NotesSidebarFooter } from './NotesSidebarFooter';
import { PinnedNotesGroup } from './PinnedNotesGroup';
import { SharedNotesEntry } from './SharedNotesEntry';
import { TagNavigation } from './TagNavigation';
import { TodosSidebarFooter } from './TodosSidebarFooter';
import { useCreateNote } from './useCreateNote';
import { useNoteSelection } from './useNoteSelection';
import { useTagStateSync } from './useTagStateSync';
import { viewStore } from './viewStore';

interface AppSidebarProps {
  authEnabled: boolean;
}

export function AppSidebar({ authEnabled }: AppSidebarProps) {
  const { notes, todos, failedSyncVersion, hasPendingSync } = useData();
  const { isMobile } = useSidebar();
  const finePointer = useFinePointer();
  const pathname = usePathname();
  const router = useRouter();
  const isTodos = isTabActive('/todos', pathname);

  // Augment notes with the synthetic FAILED_SYNC_TAG for sidebar display only.
  // useTagStateSync gets the un-augmented `notes` so opening a failed-sync note
  // never auto-jumps the sidebar into the sync-fehler folder.
  // failedSyncVersion drives the memo — getFailedSyncQueue reads localStorage,
  // which is invisible to React. Version bumps on every add/remove (not just
  // count change), so a same-tick add+remove that nets to equal length still
  // refreshes the set.
  const failedNoteIds = useMemo(
    () =>
      new Set(
        getInspectableEntries()
          .filter((e) => e.entityType === SYNC_ENTITY.NOTE)
          .map((e) => e.entityId),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- failedSyncVersion/hasPendingSync are the reactive proxies for the two queues
    [failedSyncVersion, hasPendingSync],
  );
  const displayNotes = useMemo(() => withFailedSyncTag(notes, failedNoteIds), [notes, failedNoteIds]);

  const { currentTagPath, setCurrentTagPath, noteId } = useTagStateSync({ notes, pathname });
  const view = useSyncExternalStore(viewStore.subscribe, viewStore.getSnapshot, viewStore.getServerSnapshot);
  const { pending, createNoteWithTags } = useCreateNote();
  const [folderOpen, setFolderOpen] = useState(false);
  const selection = useNoteSelection();

  // Folder = tag prefix; never create under the synthetic sync-fehler folder.
  const folderParent = currentTagPath !== '' && currentTagPath !== FAILED_SYNC_TAG ? currentTagPath : '';

  const [swipeEl, setSwipeEl] = useState<HTMLDivElement | null>(null);
  const handleTagBack = useCallback(() => {
    const parts = currentTagPath.split('/');
    parts.pop();
    setCurrentTagPath(parts.join('/'));
  }, [currentTagPath, setCurrentTagPath]);
  useSwipeBack(swipeEl, handleTagBack, isMobile && !isTodos && view === 'tags' && currentTagPath !== '');

  const handleFolderDeleted = useCallback(() => {
    handleTagBack();
    if (noteId !== null && !notes.some((n) => n.id === noteId)) {
      router.push('/notes');
    }
  }, [handleTagBack, noteId, notes, router]);

  const handleCreate = useCallback(() => {
    createNoteWithTags(folderParent !== '' ? [folderParent] : []);
  }, [createNoteWithTags, folderParent]);

  const handleCreateFolder = useCallback(
    (folderName: string) => {
      const newPath = folderParent !== '' ? `${folderParent}/${folderName}` : folderName;
      viewStore.set('tags');
      setCurrentTagPath(newPath);
      createNoteWithTags([newPath]);
    },
    [createNoteWithTags, folderParent, setCurrentTagPath],
  );

  const handleSidebarDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) {
        return;
      }

      const interactive = target.closest(
        'a, button, input, textarea, select, label, [role="button"], [role="link"], [role="menuitem"], [role="checkbox"], [role="option"], [role="tab"], [role="treeitem"], [contenteditable="true"]',
      );
      if (interactive) {
        return;
      }

      // dblclick selects the word under the cursor — clear it so the new note opens with no stray selection
      window.getSelection()?.removeAllRanges();
      handleCreate();
    },
    [handleCreate],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) {
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        router.push('/notes');
      } else if (e.key === '2') {
        e.preventDefault();
        router.push('/todos');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [router]);

  return (
    <Sidebar variant="floating">
      <AppSidebarHeader authEnabled={authEnabled} pathname={pathname} />

      <div
        ref={setSwipeEl}
        onDoubleClick={isTodos || view === 'trash' || !finePointer ? undefined : handleSidebarDoubleClick}
        className="flex min-h-0 flex-1 flex-col gap-2"
      >
        <SharedNotesEntry hidden={isTodos || view === 'trash'} />

        {!isTodos && view !== 'trash' && <PinnedNotesGroup notes={notes} />}

        {!isTodos && view === 'tags' && (
          <TagNavigation
            notes={displayNotes}
            currentPath={currentTagPath}
            setCurrentPath={setCurrentTagPath}
            onFolderDeleted={handleFolderDeleted}
            exitSelection={selection.exitSelection}
          />
        )}

        <AppSidebarBody
          isTodos={isTodos}
          view={view}
          notes={displayNotes}
          todos={todos}
          currentTagPath={currentTagPath}
          handleCreate={handleCreate}
          pending={pending}
          selection={selection}
        />
      </div>

      {isTodos ? (
        <TodosSidebarFooter />
      ) : (
        <NotesSidebarFooter
          view={view}
          handleCreate={handleCreate}
          onCreateFolder={() => {
            setFolderOpen(true);
          }}
          pending={pending}
          selection={selection}
          currentTagPath={currentTagPath}
        />
      )}

      <CreateTagFolderDialog
        parentPath={folderParent}
        open={folderOpen}
        onOpenChange={setFolderOpen}
        onCreate={handleCreateFolder}
      />
    </Sidebar>
  );
}
