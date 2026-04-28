import crypto from 'crypto';
import { after } from 'next/server';
import {
  SHARE_EXPIRY_PRESETS,
  type ShareExpiryPreset,
} from './constants';
import {
  type ShareEntry,
  type ShareRegistry,
  countExpired,
  isExpired,
  pruneExpired,
  readRegistry,
  withSharesLock,
  writeRegistry,
} from './fsSharesRegistry';
import type { ShareLookup, ShareRecord } from './shareTypes';

export type { ShareRecord };

const PRUNE_ON_READ_THRESHOLD = 8;
const PRUNE_MIN_INTERVAL_MS = 60_000;

// 32 random bytes → 43 base64url chars (no padding).
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

let lastPruneAt = 0;

function computeExpiresAt(preset: ShareExpiryPreset, now: number): string | null {
  const delta = SHARE_EXPIRY_PRESETS[preset];
  if (delta === null) {
    return null;
  }

  return new Date(now + delta).toISOString();
}

function mintToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function findTokenForNote(
  registry: ShareRegistry,
  username: string,
  noteId: string,
  now: number,
): string | null {
  for (const [token, entry] of Object.entries(registry)) {
    if (entry.username === username && entry.noteId === noteId && !isExpired(entry, now)) {
      return token;
    }
  }
  return null;
}

export async function upsertShare(
  username: string,
  noteId: string,
  preset: ShareExpiryPreset,
): Promise<ShareRecord> {
  return await withSharesLock(async () => {
    const now = Date.now();
    const registry = pruneExpired(await readRegistry(), now);

    const existingToken = findTokenForNote(registry, username, noteId, now);
    const expiresAt = computeExpiresAt(preset, now);

    if (existingToken !== null) {
      const existing = registry[existingToken];
      registry[existingToken] = { ...existing, preset, expiresAt };
      await writeRegistry(registry);
      return { token: existingToken, preset, createdAt: existing.createdAt, expiresAt };
    }

    const createdAt = new Date(now).toISOString();
    const token = mintToken();
    registry[token] = {
      username,
      noteId,
      preset,
      createdAt,
      expiresAt,
    };
    await writeRegistry(registry);
    return { token, preset, createdAt, expiresAt };
  });
}

function hasShareFor(registry: ShareRegistry, username: string, noteId: string): boolean {
  for (const entry of Object.values(registry)) {
    if (entry.username === username && entry.noteId === noteId) {
      return true;
    }
  }
  return false;
}

export async function revokeShare(username: string, noteId: string): Promise<void> {
  // Fast path: skip the lock + write entirely if there's nothing to revoke.
  // Note delete fires this for every note, most of which were never shared;
  // the read is mtime-cached so this is effectively free.
  // A concurrent upsertShare for the same note can race past this read and
  // leave an orphan share — harmless (getNote returns null → 404) but it
  // lingers in shares.json until natural expiry.
  if (!hasShareFor(await readRegistry(), username, noteId)) {
    return;
  }

  await withSharesLock(async () => {
    const registry = await readRegistry();
    const next: ShareRegistry = {};
    let matched = false;
    for (const [token, entry] of Object.entries(registry)) {
      if (entry.username === username && entry.noteId === noteId) {
        matched = true;
        continue;
      }

      next[token] = entry;
    }

    if (matched) {
      await writeRegistry(next);
    }
  });
}

function lookupToken(registry: ShareRegistry, token: string, now: number): ShareEntry | null {
  if (!Object.hasOwn(registry, token)) {
    return null;
  }

  const entry = registry[token];
  if (isExpired(entry, now)) {
    return null;
  }

  return entry;
}

async function pruneInBackground(): Promise<void> {
  await withSharesLock(async () => {
    const now = Date.now();
    const registry = await readRegistry();
    if (countExpired(registry, now) === 0) {
      return;
    }

    await writeRegistry(pruneExpired(registry, now));
  });
}

export async function getShare(token: string): Promise<ShareLookup | null> {
  if (!TOKEN_RE.test(token)) {
    return null;
  }

  const now = Date.now();
  const registry = await readRegistry();

  if (
    countExpired(registry, now) >= PRUNE_ON_READ_THRESHOLD &&
    now - lastPruneAt >= PRUNE_MIN_INTERVAL_MS
  ) {
    lastPruneAt = now;
    after(() =>
      pruneInBackground().catch((err: unknown) => {
        console.error('share prune failed', err);
      }),
    );
  }

  const entry = lookupToken(registry, token, now);
  if (entry === null) {
    return null;
  }

  return { username: entry.username, noteId: entry.noteId, expiresAt: entry.expiresAt };
}

export async function getShareByNote(
  username: string,
  noteId: string,
): Promise<ShareRecord | null> {
  const now = Date.now();
  const registry = await readRegistry();
  const token = findTokenForNote(registry, username, noteId, now);
  if (token === null) {
    return null;
  }

  const entry = registry[token];
  return { token, preset: entry.preset, createdAt: entry.createdAt, expiresAt: entry.expiresAt };
}
