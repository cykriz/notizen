'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarGroup, SidebarGroupContent, SidebarMenu } from '@/components/ui/sidebar';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { tryFetch } from '@/lib/tryFetch';
import type { SyncEntityType } from '@/lib/types';
import {
  CANCEL_LABEL,
  DEFAULT_TRASH_RETENTION_DAYS,
  SYNC_ENTITY,
  TRASH_EMPTY_ACTION_LABEL,
  TRASH_EMPTY_STATE_MESSAGE,
  TRASH_LOAD_ERROR_MESSAGE,
  TRASH_NOTES_SECTION_LABEL,
  TRASH_ONLINE_ONLY_MESSAGE,
  TRASH_TODOS_SECTION_LABEL,
} from '@/lib/constants';
import { useData } from './dataContext';
import { useTrashData } from './useTrashData';
import { TrashItemRow } from './TrashItemRow';
import { RetentionSelector } from './RetentionSelector';

const MESSAGE_CLASS = 'px-4 py-8 text-center text-sm text-muted-foreground';

// Shows one kind of trash (notes in the notes sidebar, todos in the todos
// sidebar). The retention control is the same per-user setting in both.
export function TrashView({ kind }: { kind: SyncEntityType }) {
  const { isOnline, restoreFromTrash, notes: activeNotes, todos: activeTodos, hasPendingSync } = useData();
  // Re-fetch when this kind's active list shrinks (a delete) or the sync queue
  // drains (a queued delete finally lands server-side).
  const activeCount = kind === SYNC_ENTITY.NOTE ? activeNotes.length : activeTodos.length;
  const refreshKey = `${String(activeCount)}:${hasPendingSync ? 'p' : ''}`;
  const { data, loading, error, reload, removeFromView, clearKind } = useTrashData(isOnline, refreshKey);
  const [emptyOpen, setEmptyOpen] = useState(false);

  const handleRestore = async (id: string) => {
    await restoreFromTrash(kind, id);
    removeFromView(id);
  };

  const handleDelete = async (id: string) => {
    const res = await tryFetch(`/api/trash/${kind}/${id}`, { method: 'DELETE' });
    if (res?.ok !== true) {
      throw new Error('permanent delete failed');
    }

    removeFromView(id);
  };

  const handleEmpty = () => {
    setEmptyOpen(false);
    void (async () => {
      const res = await tryFetch(`/api/trash/${kind}`, { method: 'DELETE' });
      if (res?.ok === true) {
        clearKind(kind);
      }
    })();
  };

  const handleRetention = async (days: number) => {
    const res = await tryFetch('/api/user/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: days }),
    });
    // Re-load: the PUT may have purged now-expired items.
    if (res?.ok === true) {
      await reload();
    }
  };

  if (!isOnline) {
    return <p className={MESSAGE_CLASS}>{TRASH_ONLINE_ONLY_MESSAGE}</p>;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && data === null) {
    return <p className={MESSAGE_CLASS}>{TRASH_LOAD_ERROR_MESSAGE}</p>;
  }

  const items: { id: string; title: string; trashedAt: string }[] =
    kind === SYNC_ENTITY.NOTE ? (data?.notes ?? []) : (data?.todos ?? []);
  const retentionDays = data?.retentionDays ?? DEFAULT_TRASH_RETENTION_DAYS;
  const kindLabel = kind === SYNC_ENTITY.NOTE ? TRASH_NOTES_SECTION_LABEL : TRASH_TODOS_SECTION_LABEL;
  // The retention window is global (purges notes + todos), so count both for the
  // shorten-confirmation even though this view only lists one kind.
  const trashedAtList = [
    ...(data?.notes ?? []).map((n) => n.trashedAt),
    ...(data?.todos ?? []).map((t) => t.trashedAt),
  ];

  return (
    <>
      <RetentionSelector retentionDays={retentionDays} trashedAtList={trashedAtList} onApply={handleRetention} />

      {items.length === 0 ? (
        <p className={MESSAGE_CLASS}>{TRASH_EMPTY_STATE_MESSAGE}</p>
      ) : (
        <>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <TrashItemRow
                    key={item.id}
                    title={item.title}
                    trashedAt={item.trashedAt}
                    onRestore={() => handleRestore(item.id)}
                    onDelete={() => handleDelete(item.id)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <div className="px-2 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-destructive"
              onClick={() => {
                setEmptyOpen(true);
              }}
            >
              <Trash2 /> {TRASH_EMPTY_ACTION_LABEL}
            </Button>
          </div>
        </>
      )}

      <Dialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TRASH_EMPTY_ACTION_LABEL}?</DialogTitle>
            <DialogDescription>Alle {kindLabel} im Papierkorb werden unwiderruflich gelöscht.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{CANCEL_LABEL}</Button>
            </DialogClose>
            <Button variant="destructive" autoFocus onClick={handleEmpty}>
              <Trash2 /> {TRASH_EMPTY_ACTION_LABEL}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
