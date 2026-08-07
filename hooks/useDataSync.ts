import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteSummary, Todo } from '@/lib/types';
import { NoteSummaryArraySchema, TodoArraySchema } from '@/lib/schemas';
import { getCachedNotesList, getCachedTodos, setCachedNotesList, setCachedTodos } from '@/lib/localCache';
import { getInspectableCount } from '@/lib/failedSyncQueue';
import { mergeById } from '@/lib/localCacheMerge';
import { getPendingCount, processSyncQueue } from '@/lib/syncQueue';
import { SYNC_RETRY_INTERVAL_MS, SYNC_RETRY_MAX_INTERVAL_MS } from '@/lib/constants';
import { useFailedSyncActions } from '@/hooks/useFailedSyncActions';

interface UseDataSyncArgs {
  isOnline: boolean;
  isOnlineRef: React.RefObject<boolean>;
  setNotes: React.Dispatch<React.SetStateAction<NoteSummary[]>>;
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
}

export function useDataSync({ isOnline, isOnlineRef, setNotes, setTodos }: UseDataSyncArgs) {
  const [hasPendingSync, setHasPendingSync] = useState(() => getPendingCount() > 0);
  // Counts recorded failures PLUS pending entries that could not be recorded
  // (localStorage full) — otherwise those stay invisible behind a permanent
  // "Synchronisiere…". See getInspectableEntries.
  const [failedSyncCount, setFailedSyncCount] = useState(() => getInspectableCount());
  // Bumps whenever the failed queue is mutated, even when the count nets out
  // to the same length (one removal + one addition in a single drain). Memo
  // keys depending on queue *contents* should use this, not failedSyncCount.
  const [failedSyncVersion, setFailedSyncVersion] = useState(0);

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
        const mergedNotes = mergeById(serverNotes, getCachedNotesList());
        setNotes(mergedNotes);
        setCachedNotesList(mergedNotes);
      }

      if (todosRes.ok) {
        const serverTodos = TodoArraySchema.parse(await todosRes.json());
        const mergedTodos = mergeById(serverTodos, getCachedTodos());
        setTodos(mergedTodos);
        setCachedTodos(mergedTodos);
      }

    } catch {
      // offline — ignore
    }
  }, [isOnlineRef, setNotes, setTodos]);

  // Persists across effect re-runs so backoff isn't reset when hasPendingSync toggles.
  const delayRef = useRef(SYNC_RETRY_INTERVAL_MS);

  // Single effect for processing the sync queue with exponential backoff.
  // Triggers when online status changes or hasPendingSync becomes true.
  useEffect(() => {
    if (!isOnline || !hasPendingSync) {
      // Reset backoff when queue is fully drained
      if (!hasPendingSync) {
        delayRef.current = SYNC_RETRY_INTERVAL_MS;
      }

      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (cancelled) {
        return;
      }

      if (getPendingCount() === 0) {
        setHasPendingSync(false);
        return;
      }

      try {
        await processSyncQueue();
      } catch {
        // will retry on next cycle
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by cleanup after await
      if (cancelled) {
        return;
      }

      setFailedSyncCount(getInspectableCount());
      setFailedSyncVersion((v) => v + 1);
      const remaining = getPendingCount();
      setHasPendingSync(remaining > 0);

      if (remaining === 0) {
        await refreshFromServer().catch(() => {
          // offline — ignore
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by cleanup after await
      if (!cancelled && remaining > 0) {
        timeout = setTimeout(() => void run(), delayRef.current);
        delayRef.current = Math.min(delayRef.current * 2, SYNC_RETRY_MAX_INTERVAL_MS);
      }
    };

    // Run immediately on first trigger, then use exponential backoff for retries
    void run();

    return () => {
      cancelled = true;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };
  }, [isOnline, hasPendingSync, refreshFromServer]);

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

        setFailedSyncCount(getInspectableCount());
        setFailedSyncVersion((v) => v + 1);
        const remaining = getPendingCount();
        setHasPendingSync(remaining > 0);
        if (remaining === 0) {
          void refreshFromServer().catch(() => {
            // offline — ignore
          });
        }
      })();
    }
  }, [isOnlineRef, refreshFromServer]);

  const failedSyncActions = useFailedSyncActions({
    isOnlineRef,
    setFailedSyncCount,
    setFailedSyncVersion,
    refreshFromServer,
    syncPending,
  });

  return {
    hasPendingSync,
    setHasPendingSync,
    failedSyncCount,
    failedSyncVersion,
    refreshFromServer,
    syncPending,
    ...failedSyncActions,
  };
}
