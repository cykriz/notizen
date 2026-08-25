import { describe, expect, test } from 'bun:test';

import { COMMAND_RESULT_LIMIT, FAILED_SYNC_TAG } from './constants';
import type { NoteSummary } from './types';
import { noteSearchText, rankByQuery, sortNotesForPalette, tagCreateCandidate } from './commandSearch';
import { listAllTagPaths } from './tagTree';

function note(over: Partial<NoteSummary> & { id: string; title: string }): NoteSummary {
  return {
    slug: over.title.toLowerCase(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    attachmentCount: 0,
    tags: [],
    pinned: false,
    ...over,
  };
}

const rankNotes = (notes: NoteSummary[], query: string) => rankByQuery(notes, query, noteSearchText);

describe('commandSearch', () => {
  // The bug this module exists for: cmdk scores `value` + `keywords` as one string, so with
  // value={note.id} the UUID was part of the haystack. Measured against cmdk's own scorer,
  // query 'abc' gave the irrelevant note 0.99 (its id starts with 'abc', which collects the
  // start-of-string bonus) and the genuinely matching note only 0.89 — the wrong note won.
  test('a hex query does NOT match a note just because its id contains it', () => {
    const notes = [
      note({ id: 'abc12345-4b8e-11ee-9f21-0242ac120002', title: 'Wocheneinkauf' }),
      note({ id: 'f0e1d2c3-4b8e-11ee-9f21-0242ac120002', title: 'ABC-Analyse' }),
    ];

    const hits = rankNotes(notes, 'abc');

    expect(hits.map((n) => n.title)).toEqual(['ABC-Analyse']);
  });

  test('no note matches a query that only occurs in ids', () => {
    const notes = [
      note({ id: 'dead1234-4b8e-11ee-9f21-0242ac120002', title: 'Umzug' }),
      note({ id: 'beef5678-4b8e-11ee-9f21-0242ac120002', title: 'Rezepte' }),
    ];

    expect(rankNotes(notes, 'dead')).toEqual([]);
    expect(rankNotes(notes, 'beef')).toEqual([]);
  });

  test('title match ranks above a tag-only match', () => {
    const notes = [
      note({ id: '1', title: 'Urlaubsplanung', tags: ['deployment'] }),
      note({ id: '2', title: 'Deployment', tags: ['urlaub'] }),
    ];

    expect(rankNotes(notes, 'deployment').map((n) => n.title)).toEqual(['Deployment', 'Urlaubsplanung']);
  });

  test('#tag search still finds the note', () => {
    const notes = [
      note({ id: '1', title: 'Sprint', tags: ['dev/python/fastapi'] }),
      note({ id: '2', title: 'Einkauf' }),
    ];

    expect(rankNotes(notes, '#dev/python').map((n) => n.title)).toEqual(['Sprint']);
  });

  test('honours COMMAND_RESULT_LIMIT with and without a query', () => {
    const notes = Array.from({ length: COMMAND_RESULT_LIMIT + 10 }, (_, i) =>
      note({ id: String(i), title: `Notiz ${String(i)}` }),
    );

    expect(rankNotes(notes, '')).toHaveLength(COMMAND_RESULT_LIMIT);
    expect(rankNotes(notes, 'notiz')).toHaveLength(COMMAND_RESULT_LIMIT);
  });

  test('equal scores keep the incoming order (stable sort)', () => {
    const notes = [
      note({ id: '1', title: 'Termin' }),
      note({ id: '2', title: 'Termin' }),
      note({ id: '3', title: 'Termin' }),
    ];

    expect(rankNotes(notes, 'termin').map((n) => n.id)).toEqual(['1', '2', '3']);
  });

  test('sortNotesForPalette — pinned first, then newest', () => {
    const notes = [
      note({ id: 'old', title: 'Alt', updatedAt: '2026-01-01T00:00:00.000Z' }),
      note({ id: 'pin-old', title: 'Angepinnt alt', updatedAt: '2025-01-01T00:00:00.000Z', pinned: true }),
      note({ id: 'new', title: 'Neu', updatedAt: '2026-06-01T00:00:00.000Z' }),
      note({ id: 'pin-new', title: 'Angepinnt neu', updatedAt: '2026-03-01T00:00:00.000Z', pinned: true }),
    ];

    expect(sortNotesForPalette(notes).map((n) => n.id)).toEqual(['pin-new', 'pin-old', 'new', 'old']);
  });

  test('sortNotesForPalette does not mutate its input', () => {
    const notes = [
      note({ id: 'a', title: 'A', updatedAt: '2025-01-01T00:00:00.000Z' }),
      note({ id: 'b', title: 'B', updatedAt: '2026-01-01T00:00:00.000Z' }),
    ];

    sortNotesForPalette(notes);

    expect(notes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  test('noteSearchText carries title and tags, never the id', () => {
    const text = noteSearchText(note({ id: 'abc12345', title: 'Deployment', tags: ['dev', 'ops/ci'] }));

    expect(text).toBe('Deployment #dev #ops/ci');
  });

  describe('tagCreateCandidate', () => {
    // Built the way the palette builds it, so the intermediate folder 'arbeit' is in the list
    // under its own path — which is what makes the exact match sufficient.
    const existing = listAllTagPaths([note({ id: '1', title: 'A', tags: ['arbeit/alpha'] })]);

    test('a new path is offered, normalized', () => {
      expect(tagCreateCandidate('Arbeit/Neu', existing)).toBe('arbeit/neu');
      expect(tagCreateCandidate(' Privat / Umzug ', existing)).toBe('privat/umzug');
    });

    test('an existing path is not offered — leaf or intermediate folder', () => {
      expect(tagCreateCandidate('arbeit/alpha', existing)).toBeNull();
      expect(tagCreateCandidate('arbeit', existing)).toBeNull();
      expect(tagCreateCandidate('ARBEIT', existing)).toBeNull();
    });

    test('an empty query is not offered', () => {
      expect(tagCreateCandidate('', existing)).toBeNull();
      expect(tagCreateCandidate('   ', existing)).toBeNull();
      expect(tagCreateCandidate('/', existing)).toBeNull();
    });

    test('a reserved segment is not offered, at any depth', () => {
      expect(tagCreateCandidate(FAILED_SYNC_TAG, existing)).toBeNull();
      expect(tagCreateCandidate(`${FAILED_SYNC_TAG}/x`, existing)).toBeNull();
      expect(tagCreateCandidate(`a/${FAILED_SYNC_TAG}`, existing)).toBeNull();
    });
  });
});
