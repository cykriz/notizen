import { useCallback, useEffect, useState } from 'react';
import type { NoteSummary, Todo } from '@/lib/types';
import { NoteSummaryArraySchema, TodoArraySchema } from '@/lib/schemas';
import { setCachedNotesList, setCachedTodos } from '@/lib/localCache';
import { getPendingCount, processSyncQueue } from '@/lib/syncQueue';

interface UseDataSyncArgs {
  isOnline: boolean;
  isOnlineRef: React.RefObject<boolean>;
  setNotes: React.Dispatch<React.SetStateAction<NoteSummary[]>>;
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
}

export function useDataSync({ isOnline, isOnlineRef, setNotes, setTodos }: UseDataSyncArgs) {
  const [hasPendingSync, setHasPendingSync] = useState(false);

  const refreshFromServer = useCallback(async () => {
    if (!isOnlineRef.current) {
      return;
    }

    try {
      const health = await fetch('/api/health', { method: 'POST' }).then(
        (r) => r.ok ? r.json() as Promise<{ app?: string }> : null,
      ).catch(() => null);

      if (health?.app !== 'notizen') {
        return;
      }

      const [notesRes, todosRes] = await Promise.all([fetch('/api/notes'), fetch('/api/todos')]);
      if (notesRes.ok) {
        const serverNotes = NoteSummaryArraySchema.parse(await notesRes.json());
        setNotes(serverNotes);
        setCachedNotesList(serverNotes);
      }

      if (todosRes.ok) {
        const serverTodos = TodoArraySchema.parse(await todosRes.json());
        setTodos(serverTodos);
        setCachedTodos(serverTodos);
      }

    } catch {
      // offline — ignore
    }
  }, [isOnlineRef, setNotes, setTodos]);

  useEffect(() => {
    if (!isOnline || getPendingCount() === 0) {
      return;
    }

    void (async () => {
      try {
        await processSyncQueue();
      } catch (err) {
        console.error('Sync queue processing failed:', err);
      }

      const remaining = getPendingCount();
      setHasPendingSync(remaining > 0);

      if (remaining === 0) {
        try {
          await refreshFromServer();
        } catch (err) {
          console.error('Server refresh failed:', err);
        }
      }
    })();
  }, [isOnline, refreshFromServer]);

  const syncPending = useCallback(() => {
    const count = getPendingCount();
    setHasPendingSync(count > 0);
    if (count > 0 && isOnlineRef.current) {
      void (async () => {
        try {
          await processSyncQueue();
        } catch {
          // retry on next trigger
        }

        setHasPendingSync(getPendingCount() > 0);
      })();
    }
  }, [isOnlineRef]);

  return { hasPendingSync, setHasPendingSync, refreshFromServer, syncPending };
}
