import { describe, expect, test } from 'bun:test';

import { FAILED_SYNC_TAG, SYNC_ACTION, SYNC_ENTITY, SYNC_MAX_RETRIES } from './constants';
import {
  FAILED_SYNC_CAUSE_GAVE_UP,
  FAILED_SYNC_CAUSE_GONE,
  FAILED_SYNC_CAUSE_NOT_RECORDED,
  FAILED_SYNC_CAUSE_NO_INFO,
  FAILED_SYNC_HINT_GONE,
  FAILED_SYNC_HINT_NOT_RECORDED,
  FAILED_SYNC_HINT_RETRY,
  FAILED_SYNC_TODOS_FILE,
  FAILED_SYNC_TODO_COMPLETED,
  FAILED_SYNC_TODO_QUADRANT,
} from './failedSyncConstants';
import { type FailedSyncSources, buildClipboardText, toFailedSyncDetails } from './failedSyncDetail';
import { buildFailure, dedupeByEntity } from './failedSyncQueue';
import type { SyncQueueEntry } from './localCache';
import type { Note, NoteSummary, SyncFailureInfo, Todo } from './types';

function summary(over: Partial<NoteSummary> = {}): NoteSummary {
  return {
    id: 'n1',
    slug: 'meine-notiz',
    title: 'Meine Notiz',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    attachmentCount: 0,
    tags: [],
    pinned: false,
    ...over,
  };
}

function note(over: Partial<Note> = {}): Note {
  return { ...summary(), content: 'Aus dem Cache', attachments: [], ...over };
}

function todo(over: Partial<Todo> = {}): Todo {
  return {
    id: 't1',
    title: 'Meine Aufgabe',
    quadrant: 'do',
    completed: false,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    ...over,
  };
}

function entry(over: Partial<SyncQueueEntry> = {}): SyncQueueEntry {
  return {
    entityType: SYNC_ENTITY.NOTE,
    entityId: 'n1',
    action: SYNC_ACTION.UPDATE,
    payload: {},
    timestamp: '2026-07-02T08:00:00.000Z',
    ...over,
  };
}

function failure(over: Partial<SyncFailureInfo> = {}): SyncFailureInfo {
  return {
    reason: 'non-retryable',
    status: 400,
    message: '{"error":"boom"}',
    failedAt: '2026-07-02T09:00:00.000Z',
    attempts: 1,
    ...over,
  };
}

function sources(over: Partial<FailedSyncSources> = {}): FailedSyncSources {
  return {
    notes: [],
    todos: [],
    getCachedNote: () => null,
    pendingIds: new Set(),
    unsyncedCreateIds: new Set(),
    ...over,
  };
}

function one(e: SyncQueueEntry, s: FailedSyncSources) {
  const details = toFailedSyncDetails([e], s);
  return details[0];
}

describe('failedSyncDetail — content resolution', () => {
  test('payload content wins', () => {
    const d = one(entry({ payload: { content: 'Aus dem Payload' } }), sources());
    expect(d.content).toBe('Aus dem Payload');
    expect(d.contentSource).toBe('payload');
  });

  test('pin-only update falls back to the cached note', () => {
    const d = one(entry({ payload: { pinned: true } }), sources({ getCachedNote: () => note() }));
    expect(d.content).toBe('Aus dem Cache');
    expect(d.contentSource).toBe('cache');
  });

  test('pin-only update with no cache is metadata-only, not lost text', () => {
    const d = one(entry({ payload: { pinned: true } }), sources());
    expect(d.content).toBeNull();
    expect(d.contentSource).toBe('metadata-only');
  });

  test('a create whose body cannot be found anywhere is reported as missing', () => {
    const d = one(entry({ action: SYNC_ACTION.CREATE, payload: { title: 'Ohne Text' } }), sources());
    expect(d.content).toBeNull();
    expect(d.contentSource).toBe('missing');
  });

  test('todo description comes from the cached todos list', () => {
    const e = entry({ entityType: SYNC_ENTITY.TODO, entityId: 't1', payload: { completed: true } });
    const d = one(e, sources({ todos: [todo({ description: 'Beschreibung' })] }));
    expect(d.content).toBe('Beschreibung');
    expect(d.contentSource).toBe('cache');
  });

  test('a merged todo payload renders every field it carries', () => {
    // foldQueuedEntry combines partial updates, so an entry reaching the
    // inspector can hold both a quadrant move and a tick. Both must be listed —
    // showing only one would understate what is unsynced.
    const e = entry({
      entityType: SYNC_ENTITY.TODO,
      entityId: 't1',
      payload: { quadrant: 'do', completed: true },
    });
    const labels = one(e, sources({ todos: [todo()] })).fields.map((f) => f.label);

    expect(labels).toContain(FAILED_SYNC_TODO_QUADRANT);
    expect(labels).toContain(FAILED_SYNC_TODO_COMPLETED);
  });
});

describe('failedSyncDetail — location', () => {
  test('synced note points at its file on the server', () => {
    const d = one(entry(), sources({ notes: [summary()] }));
    expect(d.serverPath).toBe('notes/meine-notiz/note.md');
    expect(d.localKey).toBe('notizen:note:n1');
  });

  test('offline-created note (empty slug) has no server path', () => {
    const d = one(entry({ action: SYNC_ACTION.CREATE }), sources({ notes: [summary({ slug: '' })] }));
    expect(d.serverPath).toBeNull();
  });

  test('an open create clears the server path even when a slug exists', () => {
    const d = one(entry(), sources({ notes: [summary()], unsyncedCreateIds: new Set(['n1']) }));
    expect(d.serverPath).toBeNull();
  });

  test('todo update points at todos.json', () => {
    const e = entry({ entityType: SYNC_ENTITY.TODO, entityId: 't1' });
    const d = one(e, sources({ todos: [todo()] }));
    expect(d.serverPath).toBe(FAILED_SYNC_TODOS_FILE);
    expect(d.localKey).toBe('notizen:todos');
  });
});

describe('failedSyncDetail — folders and title', () => {
  test('the synthetic sync-fehler tag is never shown as a folder', () => {
    const s = sources({ notes: [summary({ tags: ['arbeit/projekte', FAILED_SYNC_TAG] })] });
    expect(one(entry(), s).folders).toEqual(['arbeit/projekte']);
  });

  test('payload tags win over the summary', () => {
    const e = entry({ payload: { tags: ['privat'] } });
    const d = one(e, sources({ notes: [summary({ tags: ['arbeit'] })] }));
    expect(d.folders).toEqual(['privat']);
  });

  test('falls back to the default title when nothing is known', () => {
    expect(one(entry(), sources()).title).toBe('Unbenannt');
  });
});

describe('failedSyncDetail — cause', () => {
  test('legacy entry without failure reports an unrecorded cause', () => {
    const d = one(entry(), sources());
    expect(d.cause.cause).toBe(FAILED_SYNC_CAUSE_NO_INFO);
    expect(d.failedAt).toBeNull();
    expect(d.attempts).toBeNull();
  });

  test('404 wording differs between note and todo', () => {
    const noteD = one(entry({ failure: failure({ status: 404 }) }), sources());
    const todoD = one(
      entry({ entityType: SYNC_ENTITY.TODO, entityId: 't1', failure: failure({ status: 404 }) }),
      sources(),
    );
    expect(noteD.cause.cause).toBe(FAILED_SYNC_CAUSE_GONE.note);
    expect(todoD.cause.cause).toBe(FAILED_SYNC_CAUSE_GONE.todo);
  });

  test('max-retries inherits the last server status', () => {
    const d = one(entry({ failure: failure({ reason: 'max-retries', status: 503, attempts: 5 }) }), sources());
    expect(d.cause.statusText).toBe('HTTP-Status 503');
    expect(d.attempts).toBe(5);
  });

  test('max-retries without any response says it gave up, not "older entry"', () => {
    const d = one(
      entry({ failure: failure({ reason: 'max-retries', status: undefined, message: undefined, attempts: 5 }) }),
      sources(),
    );
    expect(d.cause.cause).toBe(FAILED_SYNC_CAUSE_GAVE_UP);
    expect(d.cause.cause).not.toBe(FAILED_SYNC_CAUSE_NO_INFO);
  });

  test('a quota failure says so instead of blaming the server', () => {
    const d = one(entry({ failure: failure({ reason: 'not-recorded', status: undefined }) }), sources());
    expect(d.cause.cause).toBe(FAILED_SYNC_CAUSE_NOT_RECORDED);
  });

  test('an actionable cause carries a hint the row can render', () => {
    expect(one(entry({ failure: failure({ status: 404 }) }), sources()).cause.hint).toBe(FAILED_SYNC_HINT_GONE);
    expect(one(entry({ failure: failure({ status: 503, reason: 'max-retries' }) }), sources()).cause.hint).toBe(
      FAILED_SYNC_HINT_RETRY,
    );
    expect(one(entry({ failure: failure({ reason: 'not-recorded' }) }), sources()).cause.hint).toBe(
      FAILED_SYNC_HINT_NOT_RECORDED,
    );
  });
});

describe('failedSyncDetail — retry gating', () => {
  test('a pending mutation for the same entity blocks retry', () => {
    const d = one(entry({ failure: failure() }), sources({ pendingIds: new Set(['n1']) }));
    expect(d.pushBlocked).toBe(true);
  });

  test('a stuck quota entry stays retryable even though it IS the pending entry', () => {
    // getStuckPendingEntries reads the pending queue, so this id is always in
    // pendingIds. Blocking it would disable the only way out of the parked state.
    const e = entry({ retryCount: SYNC_MAX_RETRIES, failure: failure({ reason: 'not-recorded' }) });
    const d = one(e, sources({ pendingIds: new Set(['n1']) }));
    expect(d.pushBlocked).toBe(false);
  });

  test('nothing pending means nothing blocked', () => {
    expect(one(entry({ failure: failure() }), sources()).pushBlocked).toBe(false);
  });
});

describe('failedSyncDetail — robustness', () => {
  test('a malformed payload does not throw', () => {
    const e = entry({ payload: { title: 42, tags: 'privat', content: null } });
    const d = one(e, sources());
    expect(d.title).toBe('Unbenannt');
    expect(d.folders).toEqual([]);
    expect(d.content).toBeNull();
  });

  test('a malformed failure does not reach the view model', () => {
    const e = entry({ failure: { reason: 'nope', attempts: {} } as unknown as SyncFailureInfo });
    const d = one(e, sources());
    expect(d.cause.cause).toBe(FAILED_SYNC_CAUSE_NO_INFO);
    expect(d.attempts).toBeNull();
    expect(d.failedAt).toBeNull();
  });
});

describe('dedupeByEntity', () => {
  test('the same entity from both queues collapses, later wins', () => {
    const recorded = entry({ failure: failure({ reason: 'non-retryable' }) });
    const stuck = entry({ failure: failure({ reason: 'not-recorded' }) });
    // Callers pass stuck entries last because they are the newer record.
    const out = dedupeByEntity([recorded, stuck]);
    expect(out).toHaveLength(1);
    expect(out[0].failure?.reason).toBe('not-recorded');
  });

  test('same id but different entity types are distinct rows', () => {
    const noteEntry = entry({ entityId: 'x' });
    const todoEntry = entry({ entityType: SYNC_ENTITY.TODO, entityId: 'x' });
    expect(dedupeByEntity([noteEntry, todoEntry])).toHaveLength(2);
  });

  test('unrelated entities are left alone', () => {
    expect(dedupeByEntity([entry({ entityId: 'a' }), entry({ entityId: 'b' })])).toHaveLength(2);
  });
});

describe('buildFailure — attempts', () => {
  test('a give-up reports the budget, not budget + 1', () => {
    // The give-up check runs BEFORE the replay, so the last counted attempt never
    // happened; reporting 6 would contradict "gave up after 5 attempts".
    const f = buildFailure(entry({ retryCount: SYNC_MAX_RETRIES }), 'max-retries');
    expect(f.attempts).toBe(SYNC_MAX_RETRIES);
  });

  test('a quota marker on top of a spent budget is capped the same way', () => {
    const f = buildFailure(entry({ retryCount: SYNC_MAX_RETRIES }), 'not-recorded');
    expect(f.attempts).toBe(SYNC_MAX_RETRIES);
  });

  test('a first-attempt rejection reports one attempt', () => {
    expect(buildFailure(entry(), 'non-retryable', { status: 400 }).attempts).toBe(1);
  });

  test('the rejecting response wins over an inherited status', () => {
    const e = entry({ failure: failure({ status: 503, message: 'alt' }) });
    const f = buildFailure(e, 'non-retryable', { status: 400, message: 'neu' });
    expect(f.status).toBe(400);
    expect(f.message).toBe('neu');
  });

  test('a give-up with no response inherits the last status it saw', () => {
    const e = entry({ retryCount: SYNC_MAX_RETRIES, failure: failure({ status: 503, message: 'down' }) });
    const f = buildFailure(e, 'max-retries');
    expect(f.status).toBe(503);
    expect(f.message).toBe('down');
  });
});

describe('failedSyncDetail — ordering, retry guard, clipboard', () => {
  test('newest failure first, mutation time as fallback', () => {
    const older = entry({ entityId: 'a', failure: failure({ failedAt: '2026-07-01T00:00:00.000Z' }) });
    const newer = entry({ entityId: 'b', failure: failure({ failedAt: '2026-07-03T00:00:00.000Z' }) });
    const legacy = entry({ entityId: 'c', timestamp: '2026-07-02T00:00:00.000Z' });
    const ids = toFailedSyncDetails([older, legacy, newer], sources()).map((d) => d.entityId);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  test('a queued mutation for the same entity blocks retry', () => {
    expect(one(entry(), sources({ pendingIds: new Set(['n1']) })).pushBlocked).toBe(true);
    expect(one(entry(), sources()).pushBlocked).toBe(false);
  });

  test('clipboard text carries title, folder and body', () => {
    const s = sources({ notes: [summary({ tags: ['arbeit'] })] });
    const text = buildClipboardText(one(entry({ payload: { content: 'Text' } }), s));
    expect(text).toBe('Meine Notiz\narbeit\n\nText');
  });
});
