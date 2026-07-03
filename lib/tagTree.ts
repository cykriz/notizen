import { FAILED_SYNC_TAG, pathHasReservedSegment } from './constants';
import type { NoteSummary } from './types';

export interface TagNode {
  segment: string;
  fullPath: string;
  noteCount: number;
  children: TagNode[];
}

// Normalizes a user-entered folder/tag path: lowercases and trims each segment,
// drops empty segments. 'A//B/' -> 'a/b', ' x ' -> 'x', '/' -> ''.
export function normalizeTagPath(raw: string): string {
  return raw
    .split('/')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== '')
    .join('/');
}

export function buildTagTree(notes: NoteSummary[]): TagNode[] {
  const root: TagNode[] = [];

  for (const note of notes) {
    for (const tag of note.tags) {
      const segments = tag.split('/');
      let level = root;
      let path = '';

      for (const seg of segments) {
        path = path !== '' ? `${path}/${seg}` : seg;
        let node = level.find((n) => n.segment === seg);
        if (!node) {
          node = { segment: seg, fullPath: path, noteCount: 0, children: [] };
          level.push(node);
        }

        node.noteCount++;
        level = node.children;
      }
    }
  }

  return sortTree(root);
}

function sortTree(nodes: TagNode[]): TagNode[] {
  nodes.sort((a, b) => a.segment.localeCompare(b.segment));
  for (const n of nodes) {
    sortTree(n.children);
  }
  return nodes;
}

export function getChildNodes(tree: TagNode[], path: string): TagNode[] {
  if (path === '') {
    return tree;
  }

  const segments = path.split('/');
  let level = tree;
  for (const seg of segments) {
    const node = level.find((n) => n.segment === seg);
    if (!node) {
      return [];
    }

    level = node.children;
  }
  return level;
}

// Replaces the `from` folder tag with `targets` (reserved/synthetic targets like
// sync-fehler are dropped, never persisted), leaving all other tags untouched, and
// also strips the synthetic FAILED_SYNC_TAG. With from='' this is a pure add.
// Returns null if nothing changed. If every target is reserved, returns null so the
// op aborts (preserves the old moveNoteToFolder reserved-target behavior).
export function replaceFolderTag(tags: string[], from: string, targets: string[]): string[] | null {
  const cleanTargets = targets.filter((t) => !pathHasReservedSegment(t));
  if (targets.length > 0 && cleanTargets.length === 0) {
    return null;
  }

  const next = tags.filter((t) => t !== from && !cleanTargets.includes(t) && t !== FAILED_SYNC_TAG);
  next.push(...cleanTargets);
  const unchanged = next.length === tags.length && next.every((t) => tags.includes(t));
  return unchanged ? null : next;
}

// Computes the new tag list when a note is dragged from the `from` folder onto the
// `target` folder: drops the source folder tag and the synthetic sync-fehler tag,
// then adds the target. Returns null if nothing changed.
export function moveNoteToFolder(tags: string[], from: string, target: string): string[] | null {
  return replaceFolderTag(tags, from, [target]);
}

export function getNotesAtPath(notes: NoteSummary[], path: string): NoteSummary[] {
  if (path === '') {
    return notes.filter((n) => n.tags.length === 0);
  }

  return notes.filter((n) => n.tags.includes(path));
}

export function getNotesUnderPath(notes: NoteSummary[], path: string): NoteSummary[] {
  if (path === '') {
    return notes;
  }

  const prefix = `${path}/`;
  return notes.filter((n) => n.tags.some((t) => t === path || t.startsWith(prefix)));
}

export function listAllTags(notes: NoteSummary[]): string[] {
  const tagSet = new Set<string>();
  for (const note of notes) {
    for (const tag of note.tags) {
      tagSet.add(tag);
    }
  }
  return [...tagSet].sort();
}

export interface TagPathEntry {
  path: string;
  noteCount: number;
  isLeaf: boolean;
}

export function listAllTagPaths(notes: NoteSummary[]): TagPathEntry[] {
  const tree = buildTagTree(notes);
  const result: TagPathEntry[] = [];

  function walk(nodes: TagNode[]) {
    for (const node of nodes) {
      result.push({
        path: node.fullPath,
        noteCount: node.noteCount,
        isLeaf: node.children.length === 0,
      });
      walk(node.children);
    }
  }

  walk(tree);
  return result;
}
