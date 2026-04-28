import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import matter from 'gray-matter';
import { USERS_DATA_DIR } from './constants';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export function getNotesRoot(): string {
  const root = process.env.NOTES_ROOT;
  return root !== undefined && root !== '' ? root : path.join(process.cwd(), 'dev-notes');
}

export function userRootFor(username: string): string {
  return path.join(getNotesRoot(), USERS_DATA_DIR, username);
}

export function notesDir(root: string): string {
  return path.join(root, 'notes');
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildSlug(title: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const id = uuidv4().split('-')[0];
  return `${date}-${slugify(title)}-${id}`;
}

export function rebuildSlug(oldSlug: string, newTitle: string): string {
  const date = oldSlug.slice(0, 10);
  const shortId = oldSlug.slice(-8);
  return `${date}-${slugify(newTitle)}-${shortId}`;
}

export function noteDir(slug: string, root: string): string {
  return path.join(notesDir(root), slug);
}

export function noteMdPath(slug: string, root: string): string {
  return path.join(noteDir(slug, root), 'note.md');
}

export function attachmentsDir(slug: string, root: string): string {
  return path.join(noteDir(slug, root), 'attachments');
}

export function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
  };
  return map[ext] ?? 'application/octet-stream';
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function readNoteFrontmatter(
  slug: string,
  root: string,
): Promise<{ data: Record<string, unknown>; content: string } | null> {
  try {
    const raw = await fs.readFile(noteMdPath(slug, root), 'utf-8');
    const parsed = matter(raw);
    return { data: parsed.data as Record<string, unknown>, content: parsed.content };
  } catch {
    return null;
  }
}

export async function countAttachments(slug: string, root: string): Promise<number> {
  try {
    const entries = await fs.readdir(attachmentsDir(slug, root));
    return entries.length;
  } catch {
    return 0;
  }
}

const noteLocks = new Map<string, Promise<unknown>>();

export async function withNoteLock<T>(noteId: string, fn: () => Promise<T>): Promise<T> {
  const prev = noteLocks.get(noteId) ?? Promise.resolve();
  const current = prev.then(fn, fn);
  noteLocks.set(noteId, current);
  try {
    return await current;
  } finally {
    if (noteLocks.get(noteId) === current) {
      noteLocks.delete(noteId);
    }
  }
}

// Per-user todos lock keyed by root path. Ensures writes to the same todos.json
// run one at a time, without blocking other users.
const todosLocks = new Map<string, Promise<unknown>>();

export async function withTodosLock<T>(root: string, fn: () => Promise<T>): Promise<T> {
  const prev = todosLocks.get(root) ?? Promise.resolve();
  const current = prev.then(fn, fn);
  todosLocks.set(root, current);
  try {
    return await current;
  } finally {
    if (todosLocks.get(root) === current) {
      todosLocks.delete(root);
    }
  }
}

export async function findSlugByNoteId(noteId: string, root: string): Promise<string | null> {
  await ensureDir(notesDir(root));
  const entries = await fs.readdir(notesDir(root), { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  for (const dir of dirs) {
    const parsed = await readNoteFrontmatter(dir.name, root);
    if (parsed?.data.id === noteId) {
      return dir.name;
    }
  }

  return null;
}
