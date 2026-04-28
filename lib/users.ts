import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getNotesRoot, ensureDir, userRootFor } from './fsHelpers';
import { AUTH_DIR, USERS_FILE, USERNAME_RE } from './constants';
import { removeUserShares } from './fsSharesRegistry';

interface StoredUser {
  username: string;
  hash: string; // scrypt:base64salt:base64hash
}

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;

function authDir(): string {
  return path.join(getNotesRoot(), AUTH_DIR);
}

function usersFilePath(): string {
  return path.join(authDir(), USERS_FILE);
}

// --- Cached file reads (10s TTL) ---

let usersCache: { data: StoredUser[]; expiresAt: number } | null = null;
const CACHE_TTL = 10_000;

function invalidateCache(): void {
  usersCache = null;
}

async function readUsersFileCached(): Promise<StoredUser[]> {
  const now = Date.now();
  if (usersCache !== null && now < usersCache.expiresAt) {
    return usersCache.data;
  }

  const data = await readUsersFileRaw();
  usersCache = { data, expiresAt: now + CACHE_TTL };
  return data;
}

export async function isAuthEnabled(): Promise<boolean> {
  const users = await readUsersFileCached();
  return users.length > 0;
}

// --- File I/O ---

async function readUsersFileRaw(): Promise<StoredUser[]> {
  try {
    const raw = await fs.readFile(usersFilePath(), 'utf-8');
    return JSON.parse(raw) as StoredUser[];
  } catch {
    return [];
  }
}

async function writeUsersFile(users: StoredUser[]): Promise<void> {
  await ensureDir(authDir());
  await fs.writeFile(usersFilePath(), JSON.stringify(users, null, 2), 'utf-8');
  invalidateCache();
}

// --- Hashing ---

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P,
  });
  return `scrypt:${salt.toString('base64')}:${derived.toString('base64')}`;
}

function verifyHash(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const salt = Buffer.from(parts[1], 'base64');
  const expected = Buffer.from(parts[2], 'base64');
  const derived = crypto.scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P,
  });
  return crypto.timingSafeEqual(derived, expected);
}

// Dummy hash used when user not found to prevent timing side-channel
const DUMMY_HASH = hashPassword('dummy-password-for-timing');

// --- Validation ---

function validateUsername(username: string): void {
  if (!USERNAME_RE.test(username)) {
    throw new Error('Ungueltiger Benutzername: nur Kleinbuchstaben, Ziffern, Bindestriche und Unterstriche (1-32 Zeichen)');
  }
}

// --- Public API ---

export async function getUser(username: string): Promise<StoredUser | null> {
  const users = await readUsersFileCached();
  return users.find((u) => u.username === username) ?? null;
}

export async function listUsers(): Promise<string[]> {
  const users = await readUsersFileCached();
  return users.map((u) => u.username);
}

export async function createUser(username: string, password: string): Promise<void> {
  validateUsername(username);
  const users = await readUsersFileRaw();
  if (users.some((u) => u.username === username)) {
    throw new Error(`User already exists: ${username}`);
  }

  users.push({ username, hash: hashPassword(password) });
  await writeUsersFile(users);
  await ensureDir(userRootFor(username));
}

export async function removeUser(username: string): Promise<void> {
  const users = await readUsersFileRaw();
  const filtered = users.filter((u) => u.username !== username);
  if (filtered.length === users.length) {
    throw new Error(`User not found: ${username}`);
  }

  await writeUsersFile(filtered);
  // Best-effort cascade: a transient I/O error here would only orphan share
  // entries (anonymous viewers 404 once the data dir is gone).
  await removeUserShares(username).catch((err: unknown) => {
    console.error('removeUserShares failed', err);
  });
}

export async function changePassword(username: string, newPassword: string): Promise<void> {
  const users = await readUsersFileRaw();
  const user = users.find((u) => u.username === username);
  if (!user) {
    throw new Error(`User not found: ${username}`);
  }

  user.hash = hashPassword(newPassword);
  await writeUsersFile(users);
}

export async function verifyPassword(username: string, password: string): Promise<string | null> {
  const user = await getUser(username);
  if (!user) {
    verifyHash(password, DUMMY_HASH);
    return null;
  }

  return verifyHash(password, user.hash) ? user.hash : null;
}

export function getPasswordHashPrefix(hash: string): string {
  return hash.slice(0, 16);
}
