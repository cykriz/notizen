---
description: Review Next.js code for bugs, performance, and best practices
---

Review the current unstaged and untracked changes in the Next.js codebase. Look for:

## Checklist

### Correctness & Bugs

- Logic errors, off-by-ones, unhandled null/undefined
- Missing error boundaries or try/catch in server actions
- Race conditions in async code or parallel fetches

### Next.js Specifics

- Correct use of `"use client"` / `"use server"` — is the component client-side when it doesn't need to be?
- Data fetching: prefer `fetch()` with caching options over `useEffect` in server components
- `useRouter`, `useSearchParams`, `usePathname` must be in client components — flag misuse
- Server Actions: validate inputs, handle errors, avoid leaking sensitive data
- Dynamic routes: check `params` typing and `generateStaticParams` if applicable
- Metadata: `export const metadata` or `generateMetadata` present on page-level files?

### Performance

- Unnecessary `"use client"` pushing logic to the browser
- Missing `Suspense` boundaries around async server components
- Images: `next/image` with `width`, `height`, and `alt`? No raw `<img>` tags
- Fonts: loaded via `next/font`, not external `@import`
- Missing `loading.tsx` or `error.tsx` for route segments that need them

### Style & Conventions

- PascalCase components, camelCase utils, kebab-case routes
- Page-specific components co-located inside the route folder
- No unused imports, dead code, or commented-out blocks

## Output Format

1. **Critical** — bugs or broken behavior
2. **Next.js issues** — wrong patterns for the framework
3. **Performance** — quick wins
4. **Minor** — style, naming, cleanup

Quote the problematic code and show the fix inline.
