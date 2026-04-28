'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { ShareExpiryPreset } from '@/lib/constants';
import type { ShareRecord } from '@/lib/shareTypes';
import {
  upsertShareLinkAction,
  getShareInfoForNoteAction,
  revokeShareLinkAction,
} from './shareActions';

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

export function useShareInfo(noteId: string, open: boolean): UseShareInfoResult {
  const [info, setInfo] = useState<ShareRecord | null>(null);
  const [fetched, setFetched] = useState(false);
  const [presetUpdated, setPresetUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const presetUpdatedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id: a slow op only applies if `latestOp.current` still matches.
  const latestOp = useRef(0);

  // Note navigation is handled by remounting (parent renders
  // <ShareNoteButton key={noteId} />), so noteId is effectively constant for
  // a given hook instance — only popover open/close needs an in-place reset.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setPresetUpdated(false);
    setError(null);
    if (!open) {
      // Drop stale state so the next open shows the skeleton, not the last value.
      setInfo(null);
      setFetched(false);
    }
  }

  // Refetch on every open (an external revoke/expiry shouldn't show stale UI).
  // The latestOp bump fires on close too so prior in-flight ops are discarded.
  useEffect(() => {
    if (presetUpdatedTimer.current) {
      clearTimeout(presetUpdatedTimer.current);
      presetUpdatedTimer.current = null;
    }

    const opId = ++latestOp.current;
    if (!open) {
      return;
    }

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
  }, [open, noteId]);

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
