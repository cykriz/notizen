'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { ShareExpiryPreset } from '@/lib/constants';
import type { ShareRecord } from '@/lib/shareTypes';
import { sharedNotesStore } from '../../sharedNotesStore';
import {
  upsertShareLinkAction,
  revokeShareLinkAction,
  getShareInfoForNoteAction,
} from '../../shareActions';

export interface UseShareInfoResult {
  info: ShareRecord | null;
  fetched: boolean;
  pending: boolean;
  presetUpdated: boolean;
  error: string | null;
  create: (preset: ShareExpiryPreset) => void;
  revoke: () => void;
  changePreset: (preset: ShareExpiryPreset) => void;
}

export function useShareInfo(noteId: string): UseShareInfoResult {
  const [info, setInfo] = useState<ShareRecord | null>(null);
  const [fetched, setFetched] = useState(false);
  const [presetUpdated, setPresetUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const presetUpdatedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id: a slow op only applies if `latestOp.current` still matches.
  const latestOp = useRef(0);

  // The sole consumer (ShareMenuView) mounts this only while the share view is
  // open and unmounts it on close / note switch, so state resets naturally on
  // unmount — the hook just fetches once on mount.
  useEffect(() => {
    if (presetUpdatedTimer.current) {
      clearTimeout(presetUpdatedTimer.current);
      presetUpdatedTimer.current = null;
    }

    const opId = ++latestOp.current;
    void getShareInfoForNoteAction(noteId)
      .then((result) => {
        if (opId !== latestOp.current) {
          return;
        }

        setInfo(result);
        setFetched(true);
      })
      .catch((err: unknown) => {
        if (opId !== latestOp.current) {
          return;
        }

        console.error(err);
        setInfo(null);
        setFetched(true);
        setError('Teilen-Status konnte nicht geladen werden.');
      });
  }, [noteId]);

  useEffect(() => {
    return () => {
      if (presetUpdatedTimer.current) {
        clearTimeout(presetUpdatedTimer.current);
      }
    };
  }, []);

  const resyncFromServer = useCallback(
    (opId: number) => {
      void getShareInfoForNoteAction(noteId)
        .then((result) => {
          if (opId !== latestOp.current) {
            return;
          }

          setInfo(result);
        })
        .catch(() => {
          // best-effort resync; original error already logged
        });
    },
    [noteId],
  );

  const runShareOp = useCallback(
    <T,>(
      opFn: () => Promise<T>,
      applyResult: (result: T) => void,
      errorMessage: string,
    ) => {
      const opId = ++latestOp.current;
      setError(null);
      // Async callback so useTransition's pending tracks the awaited op —
      // a sync callback that fires `.then` chains lets pending flip back
      // before the server-side write completes, allowing duplicate clicks.
      startTransition(async () => {
        try {
          const result = await opFn();
          if (opId !== latestOp.current) {
            return;
          }

          applyResult(result);
        } catch (err) {
          console.error(err);
          if (opId === latestOp.current) {
            setError(errorMessage);
          }

          resyncFromServer(opId);
          // Mid-response failures may have applied server-side; reconcile the
          // sidebar store so the badge doesn't lag behind reality.
          void sharedNotesStore.refresh();
        }
      });
    },
    [resyncFromServer],
  );

  const create = useCallback(
    (preset: ShareExpiryPreset) => {
      runShareOp(
        () => upsertShareLinkAction(noteId, preset),
        (result) => {
          setInfo(result);
          sharedNotesStore.upsert({ ...result, noteId });
        },
        'Teilen-Link konnte nicht erstellt werden.',
      );
    },
    [noteId, runShareOp],
  );

  const revoke = useCallback(() => {
    runShareOp(
      () => revokeShareLinkAction(noteId),
      () => {
        setInfo(null);
        sharedNotesStore.removeByNoteId(noteId);
        setPresetUpdated(false);
        if (presetUpdatedTimer.current) {
          clearTimeout(presetUpdatedTimer.current);
          presetUpdatedTimer.current = null;
        }
      },
      'Widerruf fehlgeschlagen.',
    );
  }, [noteId, runShareOp]);

  const changePreset = useCallback(
    (preset: ShareExpiryPreset) => {
      runShareOp(
        () => upsertShareLinkAction(noteId, preset),
        (result) => {
          setInfo(result);
          sharedNotesStore.upsert({ ...result, noteId });
          setPresetUpdated(true);
          if (presetUpdatedTimer.current) {
            clearTimeout(presetUpdatedTimer.current);
          }

          presetUpdatedTimer.current = setTimeout(() => {
            setPresetUpdated(false);
            presetUpdatedTimer.current = null;
          }, 1500);
        },
        'Gültigkeit konnte nicht aktualisiert werden.',
      );
    },
    [noteId, runShareOp],
  );

  return { info, fetched, pending, presetUpdated, error, create, revoke, changePreset };
}
