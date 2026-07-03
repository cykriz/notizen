import { describe, expect, test } from 'bun:test';

import { FAILED_SYNC_TAG } from './constants';
import type { NoteSummary } from './types';
import {
  buildTagTree,
  getChildNodes,
  getNotesAtPath,
  getNotesUnderPath,
  moveNoteToFolder,
  normalizeTagPath,
  replaceFolderTag,
} from './tagTree';

describe('tagTree', () => {
  const notes: NoteSummary[] = [
    { id: '1', slug: 's1', title: 'A', createdAt: '', updatedAt: '', attachmentCount: 0, tags: ['dev/ts', 'dev/python/fastapi'], pinned: false },
    { id: '2', slug: 's2', title: 'B', createdAt: '', updatedAt: '', attachmentCount: 0, tags: ['dev/ts'], pinned: false },
    { id: '3', slug: 's3', title: 'C', createdAt: '', updatedAt: '', attachmentCount: 0, tags: [], pinned: false },
  ];

  test('buildTagTree — correct root and counts', () => {
    const tree = buildTagTree(notes);
    expect(tree).toHaveLength(1);
    expect(tree[0].segment).toBe('dev');
    expect(tree[0].noteCount).toBe(3);
  });

  test('getChildNodes — returns direct children', () => {
    const tree = buildTagTree(notes);
    expect(getChildNodes(tree, 'dev')).toHaveLength(2);
  });

  test('getNotesAtPath — filters exact match', () => {
    expect(getNotesAtPath(notes, 'dev/ts')).toHaveLength(2);
  });

  test("getNotesAtPath('') — returns untagged notes", () => {
    const untagged = getNotesAtPath(notes, '');
    expect(untagged).toHaveLength(1);
    expect(untagged[0].id).toBe('3');
  });

  test('getNotesUnderPath — includes descendants', () => {
    expect(getNotesUnderPath(notes, 'dev')).toHaveLength(2);
  });

  test('normalizeTagPath — lowercases, trims, collapses slashes', () => {
    expect(normalizeTagPath('A//B/')).toBe('a/b');
    expect(normalizeTagPath(' x ')).toBe('x');
    expect(normalizeTagPath('/')).toBe('');
    expect(normalizeTagPath('Projekte/2026')).toBe('projekte/2026');
    expect(normalizeTagPath('')).toBe('');
  });
});

describe('replaceFolderTag', () => {
  test('multi-target replace — swaps `from` for all clean targets, keeps others', () => {
    expect(replaceFolderTag(['a', 'b', 'x/y'], 'a', ['p', 'q'])).toEqual(['b', 'x/y', 'p', 'q']);
  });

  test('single clean target ≡ moveNoteToFolder', () => {
    const tags = ['a', 'b'];
    expect(replaceFolderTag(tags, 'a', ['c'])).toEqual(moveNoteToFolder(tags, 'a', 'c'));
    expect(replaceFolderTag(tags, 'a', ['c'])).toEqual(['b', 'c']);
  });

  test('single reserved target → null (aborts, matches old moveNoteToFolder)', () => {
    expect(replaceFolderTag(['a', 'b'], 'a', [FAILED_SYNC_TAG])).toBeNull();
    expect(moveNoteToFolder(['a', 'b'], 'a', FAILED_SYNC_TAG)).toBeNull();
  });

  test('all targets reserved → null', () => {
    expect(replaceFolderTag(['a'], 'a', [FAILED_SYNC_TAG, `${FAILED_SYNC_TAG}/x`])).toBeNull();
  });

  test("from='' — pure add of the targets", () => {
    expect(replaceFolderTag(['a'], '', ['b'])).toEqual(['a', 'b']);
  });

  test('target already present → null (no-op)', () => {
    expect(replaceFolderTag(['a', 'b'], '', ['b'])).toBeNull();
    expect(replaceFolderTag(['a'], 'a', ['a'])).toBeNull();
  });

  test('strips synthetic FAILED_SYNC_TAG from the result', () => {
    expect(replaceFolderTag(['a', FAILED_SYNC_TAG], 'a', ['b'])).toEqual(['b']);
  });

  test('mixed reserved + clean targets — drops only the reserved one', () => {
    expect(replaceFolderTag(['a'], 'a', ['b', FAILED_SYNC_TAG])).toEqual(['b']);
  });
});
