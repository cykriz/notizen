import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { SHARES_DIR, SHARES_FILE, USERNAME_RE } from './constants';
import { getNotesRoot, ensureDir } from './fsHelpers';
import { SharePresetSchema } from './shareTypes';

const ShareEntrySchema = z.object({
  username: z.string().regex(USERNAME_RE),
  noteId: z.string(),
  preset: SharePresetSchema,
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
});

export type ShareEntry = z.infer<typeof ShareEntrySchema>;
export type ShareRegistry = Record<string, ShareEntry>;

function sharesFilePath(): string {
  return path.join(getNotesRoot(), SHARES_DIR, SHARES_FILE);
}

// In-process registry cache, invalidated by file mtime. Halves I/O for share
// traffic that hits getShare on every request and every attachment fetch.
let registryCache: { mtimeMs: number; registry: ShareRegistry } | null = null;

export async function readRegistry(): Promise<ShareRegistry> {
  const filePath = sharesFilePath();
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(filePath);
  } catch {
    registryCache = null;
    return {};
  }

  if (registryCache !== null && registryCache.mtimeMs === stat.mtimeMs) {
    return registryCache.registry;
  }

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') {
      registryCache = { mtimeMs: stat.mtimeMs, registry: {} };
      return {};
    }

    const out: ShareRegistry = {};
    for (const [token, entry] of Object.entries(parsed as Record<string, unknown>)) {
      const result = ShareEntrySchema.safeParse(entry);
      if (result.success) {
        out[token] = result.data;
      }
    }
    registryCache = { mtimeMs: stat.mtimeMs, registry: out };
    return out;
  } catch {
    registryCache = { mtimeMs: stat.mtimeMs, registry: {} };
    return {};
  }
}

export async function writeRegistry(registry: ShareRegistry): Promise<void> {
  const filePath = sharesFilePath();
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${String(process.pid)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(registry, null, 2), 'utf-8');
  await fs.rename(tmp, filePath);
  registryCache = null;
}

export function isExpired(entry: ShareEntry, now: number): boolean {
  return entry.expiresAt !== null && new Date(entry.expiresAt).getTime() <= now;
}

export function countExpired(registry: ShareRegistry, now: number): number {
  let count = 0;
  for (const entry of Object.values(registry)) {
    if (isExpired(entry, now)) {
      count++;
    }
  }
  return count;
}

export function pruneExpired(registry: ShareRegistry, now: number): ShareRegistry {
  const next: ShareRegistry = {};
  for (const [token, entry] of Object.entries(registry)) {
    if (!isExpired(entry, now)) {
      next[token] = entry;
    }
  }
  return next;
}

// In-process serialization only. Safe for single-Next-server deployments;
// does not protect against multi-process races on the same shares.json.
const sharesLock: { current: Promise<unknown> } = { current: Promise.resolve() };

export async function withSharesLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = sharesLock.current;
  // Reuse `fn` as both onFulfilled/onRejected so the chain survives a prior failure.
  const current = prev.then(fn, fn);
  sharesLock.current = current;
  try {
    return await current;
  } finally {
    if (sharesLock.current === current) {
      sharesLock.current = Promise.resolve();
    }
  }
}

// Lives here (not in fsShares.ts) so user-management code paths can cascade
// share cleanup without pulling in next/server's `after()`.
export async function removeUserShares(username: string): Promise<void> {
  let hasAny = false;
  for (const entry of Object.values(await readRegistry())) {
    if (entry.username === username) {
      hasAny = true;
      break;
    }
  }
  // Same outside-lock fast-path race as revokeShare; orphan entries are
  // harmless (anonymous viewers 404 once the user dir is gone).
  if (!hasAny) {
    return;
  }

  await withSharesLock(async () => {
    const registry = await readRegistry();
    const next: ShareRegistry = {};
    let removed = false;
    for (const [token, entry] of Object.entries(registry)) {
      if (entry.username === username) {
        removed = true;
        continue;
      }

      next[token] = entry;
    }
    if (removed) {
      await writeRegistry(next);
    }
  });
}
