'use client';

import { useCallback, useEffect, useState } from 'react';
import { tryFetch } from '@/lib/tryFetch';
import { TrashResponseSchema } from '@/lib/schemas';
import { SYNC_ENTITY } from '@/lib/constants';
import type { SyncEntityType, TrashResponse } from '@/lib/types';

async function fetchTrash(): Promise<TrashResponse | null> {
  const res = await tryFetch('/api/trash', { method: 'GET' });
  if (res?.ok !== true) {
    return null;
  }

  const parsed = TrashResponseSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : null;
}

export interface TrashData {
  data: TrashResponse | null;
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
  removeFromView: (id: string) => void;
  clearKind: (kind: SyncEntityType) => void;
}

// Fetches the trash on mount / reconnect. setState happens only after await, so
// nothing is set synchronously in the effect body. A null fetch (network/parse
// failure) surfaces as `error` rather than looking like an empty trash.
export function useTrashData(isOnline: boolean, refreshKey: string): TrashData {
  const [data, setData] = useState<TrashResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    let active = true;
    const run = async () => {
      const result = await fetchTrash();
      if (!active) {
        return;
      }

      if (result === null) {
        setError(true);
      } else {
        setData(result);
        setError(false);
      }

      setLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
    // refreshKey re-fetches when the active lists / pending-sync state change so a
    // deletion (direct or queued) appears in the trash without a manual reload.
  }, [isOnline, refreshKey]);

  const reload = useCallback(async () => {
    const result = await fetchTrash();
    if (result !== null) {
      setData(result);
      setError(false);
    }
  }, []);

  const removeFromView = useCallback((id: string) => {
    setData((d) =>
      d === null ? d : { ...d, notes: d.notes.filter((n) => n.id !== id), todos: d.todos.filter((t) => t.id !== id) },
    );
  }, []);

  const clearKind = useCallback((kind: SyncEntityType) => {
    setData((d) => {
      if (d === null) {
        return d;
      }

      return kind === SYNC_ENTITY.NOTE ? { ...d, notes: [] } : { ...d, todos: [] };
    });
  }, []);

  return { data, loading, error, reload, removeFromView, clearKind };
}
