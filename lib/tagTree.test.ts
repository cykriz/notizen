import type { NoteSummary } from './types';
import { buildTagTree, getChildNodes, getNotesAtPath, getNotesUnderPath } from './tagTree';

/* eslint-disable no-console */
function runTests() {
  const sep = '─'.repeat(50);
  console.log(`\n${sep}\n  tagTree Tests\n${sep}\n`);

  const notes: NoteSummary[] = [
    { id: '1', slug: 's1', title: 'A', createdAt: '', updatedAt: '', attachmentCount: 0, tags: ['dev/ts', 'dev/python/fastapi'], pinned: false },
    { id: '2', slug: 's2', title: 'B', createdAt: '', updatedAt: '', attachmentCount: 0, tags: ['dev/ts'], pinned: false },
    { id: '3', slug: 's3', title: 'C', createdAt: '', updatedAt: '', attachmentCount: 0, tags: [], pinned: false },
  ];

  const tree = buildTagTree(notes);
  if (tree.length !== 1 || tree[0].segment !== 'dev') {
    throw new Error('Root wrong');
  }

  if (tree[0].noteCount !== 3) {
    throw new Error(`dev count: ${String(tree[0].noteCount)}`);
  }

  console.log('✓ buildTagTree — correct root and counts');

  const tsChildren = getChildNodes(tree, 'dev');
  if (tsChildren.length !== 2) {
    throw new Error('dev children count wrong');
  }

  console.log('✓ getChildNodes — returns direct children');

  const atDev = getNotesAtPath(notes, 'dev/ts');
  if (atDev.length !== 2) {
    throw new Error(`getNotesAtPath: ${String(atDev.length)}`);
  }

  console.log('✓ getNotesAtPath — filters exact match');

  const untagged = getNotesAtPath(notes, '');
  if (untagged.length !== 1 || untagged[0].id !== '3') {
    throw new Error('Untagged filter wrong');
  }

  console.log("✓ getNotesAtPath('') — returns untagged notes");

  const underDev = getNotesUnderPath(notes, 'dev');
  if (underDev.length !== 2) {
    throw new Error(`getNotesUnderPath: ${String(underDev.length)}`);
  }

  console.log('✓ getNotesUnderPath — includes descendants');

  console.log(`\n${sep}\n  ALL TESTS PASSED ✓\n${sep}\n`);
}

runTests();
