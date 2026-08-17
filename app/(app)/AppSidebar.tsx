'use client';

import { Sidebar, useSidebar } from '@/components/ui/sidebar';
import { useFinePointer } from '@/hooks/useFinePointer';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { FAILED_SYNC_TAG, SYNC_ENTITY } from '@/lib/constants';
import { TODOS_PATH } from '@/lib/pathConstants';
import { parentTagPath } from '@/lib/tagTree';
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
import { useFailedEntityIds } from './useFailedEntityIds';
import { useNoteSelection } from './useNoteSelection';
import { useSidebarChrome } from './useSidebarChrome';
import { useTagStateSync } from './useTagStateSync';
import { viewStore } from './viewStore';

interface AppSidebarProps {
  authEnabled: boolean;
}

export function AppSidebar({ authEnabled }: AppSidebarProps) {
  const { notes, todos } = useData();
  const { isMobile } = useSidebar();
  const finePointer = useFinePointer();
  const pathname = usePathname();
  const router = useRouter();
  const isTodos = isTabActive(TODOS_PATH, pathname);

  // Augment notes with the synthetic FAILED_SYNC_TAG for sidebar display only.
  // useTagStateSync gets the un-augmented `notes` so opening a failed-sync note
  // never auto-jumps the sidebar into the sync-fehler folder.
  const failedNoteIds = useFailedEntityIds(SYNC_ENTITY.NOTE);
  const displayNotes = useMemo(() => withFailedSyncTag(notes, failedNoteIds), [notes, failedNoteIds]);

  const { currentTagPath, setCurrentTagPath, noteId } = useTagStateSync({ notes, pathname });
  const view = useSyncExternalStore(viewStore.subscribe, viewStore.getSnapshot, viewStore.getServerSnapshot);
  const { pending, createNoteWithTags } = useCreateNote();
  const [folderOpen, setFolderOpen] = useState(false);
  const selection = useNoteSelection();

  // Folder = tag prefix; never create under the synthetic sync-fehler folder.
  const folderParent = currentTagPath !== '' && currentTagPath !== FAILED_SYNC_TAG ? currentTagPath : '';

  // Pinned rows, tag folders, and who owns the boundary above the tag navigator.
  const { pinnedNotes, tagChildren, hasTagNav } = useSidebarChrome({
    notes,
    displayNotes,
    currentTagPath,
    tagView: !isTodos && view === 'tags',
  });

  const [swipeEl, setSwipeEl] = useState<HTMLDivElement | null>(null);
  const handleTagBack = useCallback(() => {
    setCurrentTagPath(parentTagPath(currentTagPath));
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
        <SharedNotesEntry
          hidden={isTodos || view === 'trash'}
          separator={pinnedNotes.length > 0 || !hasTagNav}
        />

        {!isTodos && view !== 'trash' && pinnedNotes.length > 0 && (
          <PinnedNotesGroup notes={pinnedNotes} separator={!hasTagNav} />
        )}

        {!isTodos && view === 'tags' && (
          <TagNavigation
            notes={displayNotes}
            childNodes={tagChildren}
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
