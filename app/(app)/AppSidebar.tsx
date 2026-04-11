'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, ListChecks, LogOut } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { DEFAULT_NOTE_TITLE } from '@/lib/constants';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { logoutAction } from '@/app/login/actions';
import { tagNavigationStore } from './tagNavigationStore';
import { viewStore } from './viewStore';
import { NotesSidebarContent } from './NotesSidebarContent';
import { NotesSidebarFooter } from './NotesSidebarFooter';
import { TagNavigation } from './TagNavigation';
import { TodosSidebarContent } from './TodosSidebarContent';
import { useData } from './DataProvider';
import { extractNoteId, getNoteTagPath } from '@/lib/noteUtils';

const tabs = [
  { href: '/notes', label: 'Notizen', icon: FileText },
  { href: '/todos', label: 'Aufgaben', icon: ListChecks },
] as const;

interface AppSidebarProps {
  authEnabled: boolean;
}

export function AppSidebar({ authEnabled }: AppSidebarProps) {
  const { notes, todos, createNote } = useData();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const isTodos = pathname.startsWith('/todos');

  const noteId = extractNoteId(pathname);
  const [tagState, setTagState] = useState(() => ({
    noteId,
    tagNavVersion: 0,
    path: getNoteTagPath(notes, pathname),
  }));
  const view = useSyncExternalStore(viewStore.subscribe, viewStore.getSnapshot, viewStore.getServerSnapshot);
  const tagNav = useSyncExternalStore(
    tagNavigationStore.subscribe,
    tagNavigationStore.getSnapshot,
    tagNavigationStore.getServerSnapshot,
  );
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  // Render-time sync: when a different note is opened, jump to its tag folder.
  if (noteId !== tagState.noteId) {
    const path = noteId !== null ? getNoteTagPath(notes, pathname) : tagState.path;
    setTagState({ noteId, tagNavVersion: tagState.tagNavVersion, path });
  }

  // Render-time sync: when a tag is selected from the command palette, navigate sidebar to that path.
  if (tagNav.version > tagState.tagNavVersion) {
    setTagState({ noteId: tagState.noteId, tagNavVersion: tagNav.version, path: tagNav.path });
  }

  const currentTagPath = tagState.path;
  const setCurrentTagPath = useCallback((path: string) => {
    setTagState((prev) => ({ ...prev, path }));
  }, []);

  const [swipeEl, setSwipeEl] = useState<HTMLDivElement | null>(null);
  const handleTagBack = useCallback(() => {
    const parts = currentTagPath.split('/');
    parts.pop();
    setCurrentTagPath(parts.join('/'));
  }, [currentTagPath, setCurrentTagPath]);
  useSwipeBack(swipeEl, handleTagBack, isMobile && !isTodos && view === 'tags' && currentTagPath !== '');

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
      <SidebarHeader className="gap-3">
        <div className="flex items-center gap-3">
          <SidebarMenu className="flex-row gap-1">
            {tabs.map((tab) => (
              <SidebarMenuItem key={tab.href}>
                <SidebarMenuButton asChild isActive={tab.href === '/todos' ? isTodos : !isTodos} size="sm">
                  <Link href={tab.href}>
                    <tab.icon />
                    <span>{tab.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <SyncStatusIndicator />
            {authEnabled && (
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="icon-xs" title="Abmelden">
                  <LogOut />
                </Button>
              </form>
            )}
          </div>
        </div>
      </SidebarHeader>

      <div ref={setSwipeEl} className="flex min-h-0 flex-1 flex-col gap-2">
        {!isTodos && view === 'tags' && (
          <TagNavigation notes={notes} currentPath={currentTagPath} setCurrentPath={setCurrentTagPath} />
        )}

        <SidebarContent>
          {isTodos ? (
            <TodosSidebarContent todos={todos} />
          ) : (
            <NotesSidebarContent
              notes={notes}
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
