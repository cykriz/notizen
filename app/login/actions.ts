'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyPassword } from '@/lib/users';
import { createSessionCookie } from '@/lib/auth';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from '@/lib/constants';
import { createLoginRateLimit } from '@/lib/loginRateLimit';

export interface LoginState {
  error: string | null;
}

// Checked before verification, recorded after; only a successful login clears
// the counter. Policy and eviction live in lib/loginRateLimit.ts (unit-tested);
// the user-facing wording stays here with the other messages.
const rateLimit = createLoginRateLimit();

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

  if (rateLimit.isLimited(username, Date.now())) {
    return { error: 'Zu viele Versuche. Bitte warten.' };
  }

  const passwordHash = await verifyPassword(username, password);
  if (passwordHash === null) {
    rateLimit.recordFailure(username, Date.now());
    return { error: 'Benutzername oder Passwort falsch' };
  }

  rateLimit.clear(username);

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
