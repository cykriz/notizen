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

// scrypt work factor. N=2^14 is OWASP's *minimum*, not its recommendation
// (2^17) — a deliberate trade-off for the NAS this runs on. Raising it is not a
// one-line change: the stored hash is `scrypt:salt:hash` and does NOT encode its
// parameters, so every existing hash would afterwards be verified against the
// wrong work factor. A raise needs a versioned hash format plus a re-hash on the
// next successful login first.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_BYTES = 16; // → 24 base64 characters in the stored hash
// Session-binding prefix: `scrypt:` (7 characters) plus part of the base64 salt.
// Must stay inside that salt, i.e. <= 7 + 24 — see getPasswordHashPrefix.
const HASH_PREFIX_LEN = 16;

// NIST SP 800-63B's floor. Enforced here rather than in the CLI so that every
// caller is covered — scripts/manage-users.ts is not the only entry point.
export const PASSWORD_MIN_LENGTH = 8;

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
  const salt = crypto.randomBytes(SALT_BYTES);
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
    throw new Error('Ungültiger Benutzername: nur Kleinbuchstaben, Ziffern, Bindestriche und Unterstriche (1-32 Zeichen)');
  }
}

function validatePassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Passwort zu kurz: mindestens ${String(PASSWORD_MIN_LENGTH)} Zeichen`);
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
  validatePassword(password);
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
  validatePassword(newPassword);
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

/** Reaches into the salt, never the hash — deliberately: the salt is not secret,
 *  and `hashPassword` mints a fresh random one on every write, so this prefix
 *  changes on every password change. That is what the session cookie binds to
 *  (lib/auth.ts, proxy.ts), which is why old sessions stop verifying. */
export function getPasswordHashPrefix(hash: string): string {
  return hash.slice(0, HASH_PREFIX_LEN);
}
