import { describe, expect, test } from 'bun:test';

import { SYNC_ACTION, SYNC_ENTITY, SYNC_MAX_RETRIES } from './constants';
import { planPush } from './failedSyncPush';
import type { SyncQueueEntry } from './localCache';
import type { SyncFailureInfo } from './types';

function failure(over: Partial<SyncFailureInfo> = {}): SyncFailureInfo {
  return {
    reason: 'non-retryable',
    status: 400,
    failedAt: '2026-08-04T09:00:00.000Z',
    attempts: 1,
    ...over,
  };
}

function entry(over: Partial<SyncQueueEntry> = {}): SyncQueueEntry {
  return {
    entityType: SYNC_ENTITY.NOTE,
    entityId: 'n1',
    action: SYNC_ACTION.UPDATE,
    payload: { content: 'lokal' },
    timestamp: '2026-08-04T08:00:00.000Z',
    ...over,
  };
}

const online = { isOnline: true, trashedIds: new Set<string>() };

describe('planPush', () => {
  test('offline blocks: the upload needs the network', () => {
    expect(planPush(entry(), { isOnline: false, trashedIds: null })).toBe('blocked');
  });

  test('an ordinary failure just replays the original mutation', () => {
    expect(planPush(entry({ failure: failure({ status: 400 }) }), online)).toBe('requeue');
  });

  test('a legacy entry with no recorded failure replays', () => {
    expect(planPush(entry(), online)).toBe('requeue');
  });

  test('404 on an update re-creates the entity under the same id', () => {
    expect(planPush(entry({ failure: failure({ status: 404 }) }), online)).toBe('recreate');
  });

  test('404 on an update whose entity is in the trash restores first', () => {
    // Re-creating would write a SECOND directory carrying this id, because
    // createNote's idempotency probe cannot see trashed notes.
    const strategy = planPush(entry({ failure: failure({ status: 404 }) }), {
      isOnline: true,
      trashedIds: new Set(['n1']),
    });
    expect(strategy).toBe('restore-then-push');
  });

  test('an unreadable trash blocks rather than guessing', () => {
    const strategy = planPush(entry({ failure: failure({ status: 404 }) }), {
      isOnline: true,
      trashedIds: null,
    });
    expect(strategy).toBe('blocked');
  });

  test('404 on a delete replays: absent server-side is already the goal', () => {
    const e = entry({ action: SYNC_ACTION.DELETE, payload: {}, failure: failure({ status: 404 }) });
    expect(planPush(e, online)).toBe('requeue');
  });

  test('a failed create replays rather than re-creating twice', () => {
    const e = entry({ action: SYNC_ACTION.CREATE, failure: failure({ status: 404 }) });
    expect(planPush(e, online)).toBe('requeue');
  });

  test('a quota-parked entry replays', () => {
    const e = entry({ retryCount: SYNC_MAX_RETRIES, failure: failure({ reason: 'not-recorded', status: undefined }) });
    expect(planPush(e, online)).toBe('requeue');
  });
});
