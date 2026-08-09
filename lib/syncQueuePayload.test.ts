import { describe, expect, test } from 'bun:test';

import { SYNC_ACTION, SYNC_ENTITY } from './constants';
import { foldQueuedEntry, subtractAckedKeys } from './syncQueuePayload';
import type { SyncQueueEntry } from './localCache';

function entry(over: Partial<SyncQueueEntry> = {}): SyncQueueEntry {
  return {
    entityType: SYNC_ENTITY.TODO,
    entityId: 't1',
    action: SYNC_ACTION.UPDATE,
    payload: {},
    timestamp: '2026-08-08T08:00:00.000Z',
    ...over,
  };
}

describe('foldQueuedEntry', () => {
  test('merges two partial updates instead of replacing — the drag+tick case', () => {
    const moved = entry({ payload: { quadrant: 'do' } });
    const ticked = entry({ payload: { completed: true } });

    expect(foldQueuedEntry(moved, ticked).payload).toEqual({ quadrant: 'do', completed: true });
  });

  test('a later explicit null wins — clearing a field beats an older value', () => {
    const set = entry({ payload: { description: 'alt' } });
    const cleared = entry({ payload: { description: null } });

    expect(foldQueuedEntry(set, cleared).payload).toEqual({ description: null });
  });

  test('an earlier null survives a later payload that omits its key', () => {
    // The clear has not reached the server either, so dropping it here would
    // silently un-clear the field.
    const cleared = entry({ payload: { dueDate: null } });
    const renamed = entry({ payload: { title: 'neu' } });

    expect(foldQueuedEntry(cleared, renamed).payload).toEqual({ dueDate: null, title: 'neu' });
  });

  test('keeps the incoming entry metadata, not the existing one', () => {
    const existing = entry({ payload: { quadrant: 'do' }, timestamp: '2026-08-08T08:00:00.000Z' });
    const incoming = entry({ payload: { completed: true }, timestamp: '2026-08-08T09:00:00.000Z' });

    expect(foldQueuedEntry(existing, incoming).timestamp).toBe('2026-08-08T09:00:00.000Z');
  });

  test('does not inherit retryCount or failure — a fresh change earns a fresh budget', () => {
    const spent = entry({
      payload: { quadrant: 'do' },
      retryCount: 4,
      failure: { reason: 'server-error', failedAt: '2026-08-08T08:30:00.000Z', attempts: 4 },
    });
    const fresh = entry({ payload: { completed: true } });

    const folded = foldQueuedEntry(spent, fresh);
    expect(folded.retryCount).toBeUndefined();
    expect(folded.failure).toBeUndefined();
  });

  test('CREATE and DELETE replace wholesale — they are not partial', () => {
    const created = entry({ action: SYNC_ACTION.CREATE, payload: { id: 't1', title: 'alt' } });
    const recreated = entry({ action: SYNC_ACTION.CREATE, payload: { id: 't1', title: 'neu' } });
    expect(foldQueuedEntry(created, recreated).payload).toEqual({ id: 't1', title: 'neu' });

    const deleted = entry({ action: SYNC_ACTION.DELETE, payload: {} });
    expect(foldQueuedEntry(created, deleted).payload).toEqual({});
  });
});

describe('subtractAckedKeys', () => {
  test('keeps the fields the successful write did not carry', () => {
    // The regression this exists for: a failed quadrant move must not disappear
    // from the inspector just because ticking the checkbox later succeeded.
    const failed = entry({ payload: { quadrant: 'do' } });
    const acked = entry({ payload: { completed: true } });

    expect(subtractAckedKeys(failed, acked)?.payload).toEqual({ quadrant: 'do' });
  });

  test('drops the entry once every field has been acknowledged', () => {
    const failed = entry({ payload: { quadrant: 'do' } });
    const acked = entry({ payload: { quadrant: 'do', completed: true } });

    expect(subtractAckedKeys(failed, acked)).toBeNull();
  });

  test('subtracts a key even when the acknowledged value differs', () => {
    // The server has *a* value for that field now; the queued one is superseded.
    const failed = entry({ payload: { quadrant: 'do' } });
    const acked = entry({ payload: { quadrant: 'inbox' } });

    expect(subtractAckedKeys(failed, acked)).toBeNull();
  });

  test('a successful CREATE fully acks a failed UPDATE', () => {
    const failed = entry({ payload: { quadrant: 'do' } });
    const acked = entry({ action: SYNC_ACTION.CREATE, payload: { id: 't1', title: 'neu' } });

    expect(subtractAckedKeys(failed, acked)).toBeNull();
  });

  test('a successful DELETE fully acks a failed UPDATE', () => {
    const failed = entry({ payload: { quadrant: 'do' } });
    const acked = entry({ action: SYNC_ACTION.DELETE, payload: {} });

    expect(subtractAckedKeys(failed, acked)).toBeNull();
  });

  test('a failed CREATE is stale once any write succeeds — the row exists', () => {
    const failed = entry({ action: SYNC_ACTION.CREATE, payload: { id: 't1', title: 'alt' } });
    const acked = entry({ payload: { completed: true } });

    expect(subtractAckedKeys(failed, acked)).toBeNull();
  });

  test('preserves the failure record on the surviving remainder', () => {
    const failed = entry({
      payload: { quadrant: 'do', title: 'alt' },
      failure: { reason: 'non-retryable', status: 400, failedAt: '2026-08-08T08:30:00.000Z', attempts: 1 },
    });
    const acked = entry({ payload: { title: 'neu' } });

    const remainder = subtractAckedKeys(failed, acked);
    expect(remainder?.payload).toEqual({ quadrant: 'do' });
    expect(remainder?.failure?.status).toBe(400);
  });
});
