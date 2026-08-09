import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteSummary, Todo } from '@/lib/types';
import { parseNoteSummaryRowsStrict, parseTodoRowsStrict } from '@/lib/schemas';
import { readJson } from '@/lib/offlineWrite';
import { getCachedNotesList, getCachedTodos, setCachedNotesList, setCachedTodos } from '@/lib/localCache';
import { getInspectableCount } from '@/lib/failedSyncQueue';
import { mergeById } from '@/lib/localCacheMerge';
import { getPendingCount } from '@/lib/syncQueue';
import { SYNC_RETRY_INTERVAL_MS, SYNC_RETRY_MAX_INTERVAL_MS } from '@/lib/constants';
import { useFailedSyncActions } from '@/hooks/useFailedSyncActions';
import { useSyncDrain } from '@/hooks/useSyncDrain';

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

      // readJson, not res.json(): a non-JSON 200 (an HTML error page from a proxy
      // or login redirect) would otherwise throw into the `catch` below — which is
      // labelled "offline — ignore" — and take the todo pull down with it.
      //
      // Strict parsers, so an unreadable body skips the merge instead of being
      // read as "the server has nothing", which would wipe the offline cache.
      if (notesRes.ok) {
        const serverNotes = parseNoteSummaryRowsStrict(await readJson(notesRes));
        if (serverNotes !== null) {
          const mergedNotes = mergeById(serverNotes, getCachedNotesList());
          setNotes(mergedNotes);
          setCachedNotesList(mergedNotes);
        }
      }

      if (todosRes.ok) {
        const serverTodos = parseTodoRowsStrict(await readJson(todosRes));
        if (serverTodos !== null) {
          const mergedTodos = mergeById(serverTodos, getCachedTodos());
          setTodos(mergedTodos);
          setCachedTodos(mergedTodos);
        }
      }

    } catch {
      // offline — ignore
    }
  }, [isOnlineRef, setNotes, setTodos]);

  // Persists across effect re-runs so backoff isn't reset when hasPendingSync toggles.
  const delayRef = useRef(SYNC_RETRY_INTERVAL_MS);

  const { drain, syncNow, syncPending } = useSyncDrain({
    isOnlineRef,
    delayRef,
    setHasPendingSync,
    setFailedSyncCount,
    setFailedSyncVersion,
    refreshFromServer,
  });

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

    // The drain itself lives in useSyncDrain, shared with the manual button.
    // All this effect owns is the cancellation flag and the backoff timer.
    const run = async () => {
      if (cancelled) {
        return;
      }

      if (getPendingCount() === 0) {
        setHasPendingSync(false);
        return;
      }

      await drain(false);

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by cleanup after await
      if (cancelled) {
        return;
      }

      if (getPendingCount() > 0) {
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
  }, [isOnline, hasPendingSync, drain]);

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
    syncNow,
    ...failedSyncActions,
  };
}
