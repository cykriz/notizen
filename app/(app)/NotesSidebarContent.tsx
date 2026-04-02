'use client';

import { useState, useMemo, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, FileText, Pin, Tags, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, useSidebar } from '@/components/ui/sidebar';
import { DEFAULT_NOTE_TITLE } from '@/lib/constants';
import { useData } from './DataProvider';
import { TagBrowser, getNoteTagPath } from './TagBrowser';
import { NoteListItem } from './NoteListItem';
import type { NoteSummary } from '@/lib/types';

type SidebarView = 'tags' | 'all';
const STORAGE_KEY = 'notes-sidebar-view';

const viewStore = (() => {
  const listeners = new Set<() => void>();
  let snapshot: SidebarView = 'tags';

  const subscribe = (cb: () => void) => {
    listeners.add(cb);

    return () => {
      listeners.delete(cb);
    };
  };

  const getSnapshot = (): SidebarView => {
    if (typeof window !== 'undefined' && snapshot === 'tags') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'all') {
        snapshot = 'all';
      }
    }

    return snapshot;
  };

  const getServerSnapshot = (): SidebarView => 'tags';

  const set = (v: SidebarView) => {
    snapshot = v;
    localStorage.setItem(STORAGE_KEY, v);
    for (const cb of listeners) {
      cb();
    }
  };

  return { subscribe, getSnapshot, getServerSnapshot, set };
})();

interface NotesSidebarContentProps {
  notes: NoteSummary[];
}

export function NotesSidebarContent({ notes }: NotesSidebarContentProps) {
  const { createNote } = useData();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [currentTagPath, setCurrentTagPath] = useState(() => getNoteTagPath(notes, pathname));

  const view = useSyncExternalStore(
    viewStore.subscribe,
    viewStore.getSnapshot,
    viewStore.getServerSnapshot,
  );

  const toggleView = (v: SidebarView) => {
    viewStore.set(v);
  };

  const handleCreate = useCallback(() => {
    setPending(true);
    const tags = currentTagPath !== '' ? [currentTagPath] : [];
    void createNote({ title: DEFAULT_NOTE_TITLE, content: '', tags })
      .then((note) => {
        // Only navigate if server confirmed creation (non-empty slug).
        // Offline-created notes have slug="" and can't be server-rendered.
        if (note.slug !== '') {
          router.push(`/notes/${note.id}`);
        }
      })
      .finally(() => {
        setPending(false);
      });
  }, [createNote, router, currentTagPath]);

  const pendingRef = useRef(pending);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!pendingRef.current) {
          handleCreate();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCreate]);

  const onNavigate = () => {
    setOpenMobile(false);
  };

  const pinnedNotes = useMemo(() => notes.filter((n) => n.pinned), [notes]);

  return (
    <>
      {notes.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p className="text-sm">Noch keine Notizen</p>
          <Button onClick={handleCreate} disabled={pending} variant="secondary" size="sm">
            <Plus /> Erste Notiz erstellen
          </Button>
        </div>
      )}

      {pinnedNotes.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>
            <Pin className="mr-1" /> Angepinnt
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pinnedNotes.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  isActive={pathname === `/notes/${note.id}`}
                  onNavigate={onNavigate}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {pinnedNotes.length > 0 && <Separator className="mx-4" />}

      {notes.length > 0 && (
        <SidebarGroup>
          <SidebarGroupContent>
            {view === 'tags' && <TagBrowser notes={notes} currentPath={currentTagPath} setCurrentPath={setCurrentTagPath} />}
            {view === 'all' && (
              <SidebarMenu>
                {notes.map((note) => (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    isActive={pathname === `/notes/${note.id}`}
                    onNavigate={onNavigate}
                  />
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      <div className="flex items-center gap-1 mt-auto">
        <Button size="sm" variant="ghost" onClick={handleCreate} disabled={pending} className="flex-1 justify-start">
          <Plus />
          Neue Notiz
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => {
            toggleView('tags');
          }}
          className={cn({ 'bg-accent': view === 'tags' })}
        >
          <Tags />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => {
            toggleView('all');
          }}
          className={cn({ 'bg-accent': view === 'all' })}
        >
          <List />
        </Button>
      </div>
    </>
  );
}
