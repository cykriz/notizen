'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, SidebarContent, useSidebar } from '@/components/ui/sidebar';
import { DEFAULT_NOTE_TITLE, SYNC_ENTITY } from '@/lib/constants';
import { getFailedSyncQueue } from '@/lib/failedSyncQueue';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { withFailedSyncTag } from './failedSyncTag';
import { viewStore } from './viewStore';
import { isTabActive } from './navTabs';
import { AppSidebarHeader } from './AppSidebarHeader';
import { NotesSidebarContent } from './NotesSidebarContent';
import { NotesSidebarFooter } from './NotesSidebarFooter';
import { PinnedNotesGroup } from './PinnedNotesGroup';
import { SharedNotesEntry } from './SharedNotesEntry';
import { TagNavigation } from './TagNavigation';
import { TodosSidebarContent } from './TodosSidebarContent';
import { useData } from './dataContext';
import { useTagStateSync } from './useTagStateSync';

interface AppSidebarProps {
  authEnabled: boolean;
}

export function AppSidebar({ authEnabled }: AppSidebarProps) {
  const { notes, todos, createNote, failedSyncVersion } = useData();
  const { isMobile, setOpenMobile } = useSidebar();
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
    () => new Set(getFailedSyncQueue().filter((e) => e.entityType === SYNC_ENTITY.NOTE).map((e) => e.entityId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- failedSyncVersion is the reactive proxy for the queue contents
    [failedSyncVersion],
  );
  const displayNotes = useMemo(() => withFailedSyncTag(notes, failedNoteIds), [notes, failedNoteIds]);

  const { currentTagPath, setCurrentTagPath, noteId } = useTagStateSync({ notes, pathname });
  const view = useSyncExternalStore(viewStore.subscribe, viewStore.getSnapshot, viewStore.getServerSnapshot);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

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
    if (pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setPending(true);
    const tags = currentTagPath !== '' ? [currentTagPath] : [];
    void createNote({ title: DEFAULT_NOTE_TITLE, content: '', tags })
      .then((note) => {
        if (note.slug !== '') {
          setOpenMobile(false);
          router.push(`/notes/${note.id}`);
        }
      })
      .finally(() => {
        pendingRef.current = false;
        setPending(false);
      });
  }, [createNote, router, currentTagPath, setOpenMobile]);

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
        onDoubleClick={isTodos || isMobile ? undefined : handleSidebarDoubleClick}
        className="flex min-h-0 flex-1 flex-col gap-2"
      >
        <SharedNotesEntry hidden={isTodos} />

        {!isTodos && <PinnedNotesGroup notes={notes} />}

        {!isTodos && view === 'tags' && (
          <TagNavigation
            notes={displayNotes}
            currentPath={currentTagPath}
            setCurrentPath={setCurrentTagPath}
            onFolderDeleted={handleFolderDeleted}
          />
        )}

        <SidebarContent>
          {isTodos ? (
            <TodosSidebarContent todos={todos} />
          ) : (
            <NotesSidebarContent
              notes={displayNotes}
              currentTagPath={currentTagPath}
              view={view}
              handleCreate={handleCreate}
              pending={pending}
            />
          )}
        </SidebarContent>
      </div>

      {!isTodos && <NotesSidebarFooter view={view} handleCreate={handleCreate} pending={pending} />}
    </Sidebar>
  );
}
