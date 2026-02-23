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

/* eslint-disable no-console */
function runTests() {
  const sep = "─".repeat(50);
  console.log(`\n${sep}\n  tagTree Inline Tests\n${sep}\n`);

  const notes: NoteSummary[] = [
    { id: "1", slug: "s1", title: "A", createdAt: "", updatedAt: "", attachmentCount: 0, tags: ["dev/ts", "dev/python/fastapi"], pinned: false },
    { id: "2", slug: "s2", title: "B", createdAt: "", updatedAt: "", attachmentCount: 0, tags: ["dev/ts"], pinned: false },
    { id: "3", slug: "s3", title: "C", createdAt: "", updatedAt: "", attachmentCount: 0, tags: [], pinned: false },
  ];

  const tree = buildTagTree(notes);
  if (tree.length !== 1 || tree[0].segment !== "dev") {
    throw new Error("Root wrong");
  }

  if (tree[0].noteCount !== 3) {
    throw new Error(`dev count: ${String(tree[0].noteCount)}`);
  }

  console.log("✓ buildTagTree — correct root and counts");

  const tsChildren = getChildNodes(tree, "dev");
  if (tsChildren.length !== 2) {
    throw new Error("dev children count wrong");
  }

  console.log("✓ getChildNodes — returns direct children");

  const atDev = getNotesAtPath(notes, "dev/ts");
  if (atDev.length !== 2) {
    throw new Error(`getNotesAtPath: ${String(atDev.length)}`);
  }

  console.log("✓ getNotesAtPath — filters exact match");

  const untagged = getNotesAtPath(notes, "");
  if (untagged.length !== 1 || untagged[0].id !== "3") {
    throw new Error("Untagged filter wrong");
  }

  console.log("✓ getNotesAtPath('') — returns untagged notes");

  const underDev = getNotesUnderPath(notes, "dev");
  if (underDev.length !== 2) {
    throw new Error(`getNotesUnderPath: ${String(underDev.length)}`);
  }

  console.log("✓ getNotesUnderPath — includes descendants");

  console.log(`\n${sep}\n  ALL TESTS PASSED ✓\n${sep}\n`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("tagTree.ts")) {
  runTests();
}
