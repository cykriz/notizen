import { describe, expect, test } from 'bun:test';

import { FAILED_SYNC_TAG } from './constants';
import { resolveSidebarPath } from './sidebarPath';
import type { NoteSummary } from './types';

function note(tags: string[]): NoteSummary {
  return { id: 'n', slug: 's', title: 'T', createdAt: '', updatedAt: '', attachmentCount: 0, tags, pinned: false };
}

describe('resolveSidebarPath', () => {
  test('keeps the folder while the note is listed in it', () => {
    expect(resolveSidebarPath('work', note(['work']), false)).toBe('work');
  });

  test('keeps the folder for a multi-tag note listed in it, even if it is not the first tag', () => {
    expect(resolveSidebarPath('home', note(['work', 'home']), false)).toBe('home');
  });

  test('keeps root for an untagged note', () => {
    expect(resolveSidebarPath('', note([]), false)).toBe('');
  });

  // The reported bug: standing in an ancestor counted as "on the note's path", although the
  // ancestor does not list the note — moving it one level down made it vanish from the list.
  test('follows the note from an ancestor down into its own folder', () => {
    expect(resolveSidebarPath('work', note(['work/clients']), false)).toBe('work/clients');
  });

  test('follows a tagged note out of root', () => {
    expect(resolveSidebarPath('', note(['work']), false)).toBe('work');
  });

  test('follows a note that lost its last tag back to root', () => {
    expect(resolveSidebarPath('work', note([]), false)).toBe('');
  });

  test('jumps to an unrelated folder when none of the tags is near the current one', () => {
    expect(resolveSidebarPath('home', note(['work', 'hobby']), false)).toBe('work');
  });

  test('prefers the tag below the current folder over the first tag', () => {
    expect(resolveSidebarPath('home', note(['work', 'home/garden']), false)).toBe('home/garden');
  });

  test('a sibling sharing a name prefix does not count as nearby', () => {
    expect(resolveSidebarPath('work', note(['hobby', 'workshop']), false)).toBe('hobby');
  });

  test('stays in the sync-fehler folder for a failed note', () => {
    expect(resolveSidebarPath(FAILED_SYNC_TAG, note(['work']), true)).toBe(FAILED_SYNC_TAG);
  });

  test('follows a healthy note out of the sync-fehler folder', () => {
    expect(resolveSidebarPath(FAILED_SYNC_TAG, note(['work']), false)).toBe('work');
  });
});
