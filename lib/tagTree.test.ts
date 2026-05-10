import { describe, expect, test } from 'bun:test';

import type { NoteSummary } from './types';
import { buildTagTree, getChildNodes, getNotesAtPath, getNotesUnderPath } from './tagTree';

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
});
