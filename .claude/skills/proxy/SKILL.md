---
name: proxy
description: Auth system, proxy (middleware) layer, session cookies, user management, login/setup flow, and public paths. Use when modifying authentication, adding protected routes, or changing the proxy logic.
---

## Proxy (`proxy.ts`)

Next.js 16 renamed middleware to proxy. The file exports `proxy(request)` and a `config` with matcher. No route segment configs allowed (`export const runtime` etc.) — proxy always runs on Node.js.

- **Public paths** (bypass auth): `/login`, `/setup`, `/share/`, `/_next/`, `/serwist/`, `/manifest.webmanifest`, `/icons/`, `/api/health`, `/offline`, `/favicon.ico`
- Responses under `/share/` additionally get `Cache-Control: private, max-age=0, must-revalidate` so revocation/expiry take effect immediately
- **No users configured** → redirect to `/setup` (API routes get 401)
- **No/invalid session** → redirect to `/login` (API routes get 401)
- Validates session cookie signature + expiry + password-hash prefix match

## Session Cookies (`lib/auth.ts`)

HMAC-SHA256 signed cookies. Format: `base64url(payload).base64url(signature)`.

Payload: `{ sub: username, phash: passwordHashPrefix, exp: unixTimestamp }`

| Function | Purpose |
|---|---|
| `createSessionCookie(username, hash)` | Create signed cookie |
| `verifySessionCookie(cookie)` | Verify signature + expiry → `SessionData \| null` |
| `getSessionUsername()` | Read + validate cookie from `next/headers` |
| `getUserDataDir()` | Authenticated user's data dir, throws `UnauthorizedError` or `NoUsersConfiguredError` |
| `getUserSession()` | `{ root, username }` — throws same auth errors as above |
| `requireAuth()` / `requireAuthSession()` | Same as above but redirect to `/login` on auth errors only; non-auth errors propagate to the nearest error boundary |

Secret stored at `NOTES_ROOT/.auth/secret.key` (auto-generated on first use).

## User Management (`lib/users.ts`)

Users stored in `NOTES_ROOT/.auth/users.json`. Passwords hashed with scrypt.

| Function | Purpose |
|---|---|
| `isAuthEnabled()` | True if any users exist (10s cache) |
| `getUser(username)` | Lookup by username |
| `createUser(username, password)` | Add user + create data dir |
| `removeUser(username)` | Remove user |
| `changePassword(username, password)` | Update password hash |
| `verifyPassword(username, password)` | Verify credentials (timing-safe) |
| `getPasswordHashPrefix(hash)` | First 16 chars of hash (for session binding) |

CLI: `bun run scripts/manage-users.ts` (add/remove/passwd/list).

## Auth Constants (`lib/constants.ts`)

```
AUTH_COOKIE_NAME = 'notizen-session'
AUTH_COOKIE_MAX_AGE = 7 days
AUTH_DIR = '.auth'
USERS_FILE = 'users.json'
AUTH_SECRET_FILE = 'secret.key'
USERS_DATA_DIR = 'users'
```

## Pages

- `app/login/page.tsx` — login form (client component), clears localStorage + SW caches on mount
- `app/login/actions.ts` — `loginAction` (rate-limited: 5/60s per user), `logoutAction`
- `app/setup/page.tsx` — setup instructions (shown when no users exist)
- `app/(app)/layout.tsx` — calls `getUserDataDir()`, catches errors to redirect

## Per-User Data Isolation

Each user's data lives at `NOTES_ROOT/users/<username>/`. The `getUserDataDir()` function returns this path for the authenticated user, and all fs helpers use it as the root.
