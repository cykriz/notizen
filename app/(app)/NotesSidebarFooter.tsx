'use client';

import { useEffect, useRef } from 'react';
import { Plus, FolderPlus, Tags, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SidebarFooter } from '@/components/ui/sidebar';
import { NEW_FOLDER_LABEL } from '@/lib/constants';
import { viewStore, type SidebarView } from './viewStore';

interface NotesSidebarFooterProps {
  view: SidebarView;
  handleCreate: () => void;
  onCreateFolder: () => void;
  pending: boolean;
}

export function NotesSidebarFooter({ view, handleCreate, onCreateFolder, pending }: NotesSidebarFooterProps) {
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

  return (
    <SidebarFooter>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={handleCreate} disabled={pending} className="flex-1 justify-start">
          <Plus />
          Neue Notiz
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onCreateFolder}
          disabled={pending}
          title={NEW_FOLDER_LABEL}
        >
          <FolderPlus />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => {
            viewStore.set('tags');
          }}
          className={cn({ 'bg-accent': view === 'tags' })}
        >
          <Tags />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => {
            viewStore.set('all');
          }}
          className={cn({ 'bg-accent': view === 'all' })}
        >
          <List />
        </Button>
      </div>
    </SidebarFooter>
  );
}
