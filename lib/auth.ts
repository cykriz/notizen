import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getNotesRoot, userRootFor } from './fsHelpers';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE, AUTH_DIR, AUTH_SECRET_FILE } from './constants';
import { LOGIN_PATH, SETUP_PATH } from './pathConstants';
import { isAuthEnabled, getUser, getPasswordHashPrefix } from './users';

function secretFilePath(): string {
  return path.join(getNotesRoot(), AUTH_DIR, AUTH_SECRET_FILE);
}

// --- HMAC Secret ---

let secretPromise: Promise<string> | null = null;

async function getOrCreateSecret(): Promise<string> {
  secretPromise ??= loadOrCreateSecret();
  try {
    return await secretPromise;
  } catch (err) {
    secretPromise = null;
    throw err;
  }
}

async function loadOrCreateSecret(): Promise<string> {
  const filePath = secretFilePath();
  try {
    return (await fs.readFile(filePath, 'utf-8')).trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, secret, 'utf-8');
    return secret;
  }
}

async function getSigningKey(): Promise<Buffer> {
  const secret = await getOrCreateSecret();
  return Buffer.from(secret, 'hex');
}

// --- Cookie Signing ---

function sign(payload: string, key: Buffer): string {
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

function encodePayload(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodePayload(encoded: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// --- Public API ---

export async function createSessionCookie(username: string, passwordHash: string): Promise<string> {
  const key = await getSigningKey();
  const payload = encodePayload({
    sub: username,
    phash: getPasswordHashPrefix(passwordHash),
    exp: Math.floor(Date.now() / 1000) + AUTH_COOKIE_MAX_AGE,
  });
  const signature = sign(payload, key);
  return `${payload}.${signature}`;
}

export interface SessionData {
  username: string;
  phash: string;
}

export async function verifySessionCookie(cookie: string): Promise<SessionData | null> {
  const dotIdx = cookie.indexOf('.');
  if (dotIdx === -1) {
    return null;
  }

  const payload = cookie.slice(0, dotIdx);
  const signature = cookie.slice(dotIdx + 1);

  const key = await getSigningKey();
  const expected = sign(payload, key);

  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  const data = decodePayload(payload);
  if (!data) {
    return null;
  }

  const exp = data.exp as number;
  if (typeof exp !== 'number' || exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  const sub = data.sub;
  const phash = data.phash;
  if (typeof sub !== 'string' || typeof phash !== 'string') {
    return null;
  }

  return { username: sub, phash };
}

export async function getSessionUsername(): Promise<string | null> {
  const enabled = await isAuthEnabled();
  if (!enabled) {
    return null;
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (cookie === undefined) {
    return null;
  }

  const session = await verifySessionCookie(cookie);
  if (!session) {
    return null;
  }

  const user = await getUser(session.username);
  if (!user) {
    return null;
  }

  if (getPasswordHashPrefix(user.hash) !== session.phash) {
    return null;
  }

  return session.username;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export class NoUsersConfiguredError extends Error {
  constructor() {
    super('No users configured');
    this.name = 'NoUsersConfiguredError';
  }
}

export async function getUserSession(): Promise<{ root: string; username: string }> {
  const username = await getSessionUsername();
  if (username !== null) {
    return { root: userRootFor(username), username };
  }

  const enabled = await isAuthEnabled();
  if (enabled) {
    throw new UnauthorizedError();
  }

  throw new NoUsersConfiguredError();
}

export async function getUserDataDir(): Promise<string> {
  return (await getUserSession()).root;
}

/** getUserSession with redirect to /login (or /setup if no users exist) on
 *  auth failure. Non-auth errors (e.g. transient I/O) propagate to the
 *  nearest error boundary. */
export async function requireAuthSession(): Promise<{ root: string; username: string }> {
  try {
    return await getUserSession();
  } catch (err) {
    if (err instanceof NoUsersConfiguredError) {
      redirect(SETUP_PATH);
    }

    if (err instanceof UnauthorizedError) {
      redirect(LOGIN_PATH);
    }

    throw err;
  }
}

export async function requireAuth(): Promise<string> {
  return (await requireAuthSession()).root;
}

export { isAuthEnabled } from './users';
