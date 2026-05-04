'use client';

import type { UserShareRecord } from '@/lib/shareTypes';
import { listSharedNotesAction } from './shareActions';

type Snapshot = UserShareRecord[] | null;

export const sharedNotesStore = (() => {
  const listeners = new Set<() => void>();
  let snapshot: Snapshot = null;
  let inFlight: Promise<void> | null = null;
  let pendingRefresh = false;

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };

  const getSnapshot = (): Snapshot => snapshot;

  const getServerSnapshot = (): Snapshot => null;

  const emit = () => {
    for (const cb of listeners) {
      cb();
    }
  };

  const set = (next: UserShareRecord[]) => {
    snapshot = next;
    emit();
  };

  const fetchOnce = async (): Promise<void> => {
    try {
      const result = await listSharedNotesAction();
      set(result);
    } catch (err) {
      console.error('shared-notes refresh failed', err);
    }
  };

  // A second `refresh()` call while one is in flight schedules a follow-up
  // fetch instead of awaiting the in-flight result — the latter cannot
  // reflect mutations that happened after it was issued (e.g. an upsert
  // between dialog open and dedupe). All callers (in-flight and queued)
  // await until the chain has fully drained, so `await refresh()` always
  // resolves with the snapshot reflecting every refresh issued up to that
  // point.
  // Read through functions so TS doesn't narrow `pendingRefresh`/`inFlight`
  // to their last-assigned values across an await suspension.
  const wasPending = () => pendingRefresh;
  const currentInFlight = () => inFlight;
  const refresh = async (): Promise<void> => {
    if (inFlight !== null) {
      pendingRefresh = true;
      let chain = currentInFlight();
      while (chain !== null) {
        await chain;
        chain = currentInFlight();
      }
      return;
    }

    do {
      pendingRefresh = false;
      inFlight = fetchOnce().finally(() => {
        inFlight = null;
      });
      await inFlight;
    } while (wasPending());
  };

  // Optimistic local removal — caller is expected to also call `refresh()` so
  // a failed mutation re-syncs from the server.
  // If a refresh is in flight when this lands, schedule a follow-up: the
  // in-flight fetch was issued before this mutation and would otherwise
  // overwrite it on resolve.
  const removeByNoteId = (noteId: string) => {
    if (snapshot === null) {
      return;
    }

    const next = snapshot.filter((s) => s.noteId !== noteId);
    if (next.length === snapshot.length) {
      return;
    }

    snapshot = next;
    if (inFlight !== null) {
      pendingRefresh = true;
    }

    emit();
  };

  // Optimistic in-place insert/replace. If the snapshot has never been
  // hydrated, fall through to a full refresh so we don't show a list with
  // only the just-created share.
  // If a refresh is in flight, also queue a follow-up — see removeByNoteId.
  const upsert = (record: UserShareRecord) => {
    if (snapshot === null) {
      void refresh();
      return;
    }

    const next = snapshot.filter((s) => s.noteId !== record.noteId);
    next.push(record);
    next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    snapshot = next;
    if (inFlight !== null) {
      pendingRefresh = true;
    }

    emit();
  };

  return { subscribe, getSnapshot, getServerSnapshot, refresh, removeByNoteId, upsert };
})();
