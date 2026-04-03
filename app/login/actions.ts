'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyPassword } from '@/lib/users';
import { createSessionCookie } from '@/lib/auth';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from '@/lib/constants';

export interface LoginState {
  error: string | null;
}

// --- Rate Limiting ---

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

function checkRateLimit(username: string): string | null {
  const now = Date.now();
  const entry = attempts.get(username);

  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_ATTEMPTS) {
      return 'Zu viele Versuche. Bitte warten.';
    }

    entry.count++;
    return null;
  }

  attempts.set(username, { count: 1, resetAt: now + WINDOW_MS });
  return null;
}

// --- Actions ---

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = (formData.get('username') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';

  if (username === '' || password === '') {
    return { error: 'Benutzername oder Passwort falsch' };
  }

  const rateLimitError = checkRateLimit(username);
  if (rateLimitError !== null) {
    return { error: rateLimitError };
  }

  const passwordHash = await verifyPassword(username, password);
  if (passwordHash === null) {
    return { error: 'Benutzername oder Passwort falsch' };
  }

  const token = await createSessionCookie(username, passwordHash);
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  });

  redirect('/notes');
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect('/login');
}
