import type { NoteSummary } from "./types";

export interface TagNode {
  segment: string;
  fullPath: string;
  noteCount: number;
  children: TagNode[];
}

export function buildTagTree(notes: NoteSummary[]): TagNode[] {
  const root: TagNode[] = [];

  for (const note of notes) {
    for (const tag of note.tags) {
      const segments = tag.split("/");
      let level = root;
      let path = "";

      for (const seg of segments) {
        path = path !== "" ? `${path}/${seg}` : seg;
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
  if (path === "") {
    return tree;
  }

  const segments = path.split("/");
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

export function getNotesAtPath(notes: NoteSummary[], path: string): NoteSummary[] {
  if (path === "") {
    return notes.filter((n) => n.tags.length === 0);
  }

  return notes.filter((n) => n.tags.includes(path));
}

export function getNotesUnderPath(notes: NoteSummary[], path: string): NoteSummary[] {
  if (path === "") {
    return notes;
  }

  const prefix = `${path}/`;
  return notes.filter((n) =>
    n.tags.some((t) => t === path || t.startsWith(prefix))
  );
}
