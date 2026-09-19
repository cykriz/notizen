import { useCallback, useState } from 'react';
import type { NoteSummary, Todo } from '@/lib/types';
import { parseNoteSummaryRowsStrict, parseTodoRowsStrict } from '@/lib/schemas';
import { readJson } from '@/lib/offlineWrite';
import { getCachedNotesList, getCachedTodos, setCachedNotesList, setCachedTodos } from '@/lib/localCache';
import { mergeById } from '@/lib/localCacheMerge';
import { fetchHealth } from '@/lib/fetchHealth';
import { fetchNoteBody, pullStaleNoteBodies } from '@/lib/syncNoteBodies';

interface UseServerPullArgs {
  isOnlineRef: React.RefObject<boolean>;
  setNotes: React.Dispatch<React.SetStateAction<NoteSummary[]>>;
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
}

/**
 * The one place the server state is pulled. Split out of useDataSync to keep it
 * under the 200-line cap — same precedent as hooks/useSyncDrain.ts.
 */
export function useServerPull({ isOnlineRef, setNotes, setTodos }: UseServerPullArgs) {
  // Ids whose CACHED BODY a pull replaced. A new array identity per pull is the
  // signal an open editor needs: nothing else in this state says "the content
  // under you changed, and it was not your own save".
  const [pulledNoteIds, setPulledNoteIds] = useState<string[]>([]);

  /**
   * Pulls the server state. `false` means the pull did not fully land — the
   * manual sync turns that into the error icon, the retry loop ignores it.
   *
   * Silence was the bug: every failure below used to be a bare `return`, so a
   * click that fetched nothing looked exactly like a successful one.
   */
  const refreshFromServer = useCallback(async (): Promise<boolean> => {
    if (!isOnlineRef.current) {
      return false;
    }

    try {
      // Not redundant with isOnlineRef: that carries useOnlineStatus's last
      // result, which only refreshes on mount / online / visibilitychange. A
      // foreign server on the same port answering `[]` would pass the strict
      // parsers below and wipe the offline cache — this is the gate.
      if (!(await fetchHealth())) {
        return false;
      }

      const [notesRes, todosRes] = await Promise.all([fetch('/api/notes'), fetch('/api/todos')]);

      // readJson, not res.json(): a non-JSON 200 (an HTML error page from a proxy
      // or login redirect) would otherwise throw into the `catch` below — which is
      // labelled "offline — ignore" — and take the todo pull down with it.
      //
      // Strict parsers, so an unreadable body skips the merge instead of being
      // read as "the server has nothing", which would wipe the offline cache.
      //
      // The two halves stay independent on purpose: a failing notes pull must
      // not cost the todos their update. `complete` only decides what is
      // REPORTED, never what is merged.
      let complete = true;
      let mergedNotes: NoteSummary[] | null = null;

      if (notesRes.ok) {
        const serverNotes = parseNoteSummaryRowsStrict(await readJson(notesRes));
        if (serverNotes !== null) {
          mergedNotes = mergeById(serverNotes, getCachedNotesList());
          setNotes(mergedNotes);
          setCachedNotesList(mergedNotes);
        } else {
          complete = false;
        }
      } else {
        complete = false;
      }

      if (todosRes.ok) {
        const serverTodos = parseTodoRowsStrict(await readJson(todosRes));
        if (serverTodos !== null) {
          const mergedTodos = mergeById(serverTodos, getCachedTodos());
          setTodos(mergedTodos);
          setCachedTodos(mergedTodos);
        } else {
          complete = false;
        }
      } else {
        complete = false;
      }

      // Bodies last, and off the MERGED list: /api/notes carries no `content`,
      // so without this a note edited on another device stays stale forever.
      if (mergedNotes !== null) {
        const bodies = await pullStaleNoteBodies(mergedNotes, fetchNoteBody);
        if (bodies.replaced.length > 0) {
          setPulledNoteIds(bodies.replaced);
        }

        // A body the server would not hand over leaves that note stale, which is
        // not a sync the user should be told landed.
        if (bodies.failed > 0) {
          complete = false;
        }
      }

      return complete;
    } catch {
      // offline, or the fetch itself threw — not a completed pull either way.
      return false;
    }
  }, [isOnlineRef, setNotes, setTodos]);

  return { refreshFromServer, pulledNoteIds };
}
