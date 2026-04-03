import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/constants';
import { isAuthEnabled, getUser, getPasswordHashPrefix } from '@/lib/users';
import { verifySessionCookie } from '@/lib/auth';

const PUBLIC_PREFIXES = [
  '/login',
  '/setup',
  '/_next/',
  '/serwist/',
  '/manifest.webmanifest',
  '/icons/',
  '/api/health',
  '/offline',
  '/favicon.ico',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasUsers = await isAuthEnabled();

  if (!hasUsers) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.redirect(new URL('/setup', request.url));
  }

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookie === undefined) {
    return deny(request);
  }

  const session = await verifySessionCookie(cookie);
  if (!session) {
    return deny(request);
  }

  const user = await getUser(session.username);
  if (!user || getPasswordHashPrefix(user.hash) !== session.phash) {
    return deny(request);
  }

  return NextResponse.next();
}

function deny(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
