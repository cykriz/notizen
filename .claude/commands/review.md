---
description: Review Next.js code for bugs, performance, and best practices
---

Review the current unstaged and untracked changes in the Next.js codebase.

## Step 0 — Discover Applicable Skills

Scan `.claude/skills/**/SKILL.md` and read the `description` field from each file's frontmatter. For every changed file, determine which skill(s) apply based on the description and the file's location/purpose. Then read the full SKILL.md only for skills that matched at least one changed file.

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

### Skill Compliance

For each changed file, verify it follows the rules defined in its matching skill(s). Flag any code that violates a convention from a SKILL.md. Tag each finding with the skill name (e.g. `[styling]`, `[architecture]`).

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
2. **Skill violations** — code that breaks a rule from a SKILL.md (cite the rule)
3. **Next.js issues** — wrong patterns for the framework
4. **Performance** — quick wins
5. **Minor** — style, naming, cleanup

Quote the problematic code and show the fix inline.

## TODO Summary

At the very end, add a short numbered list of all findings as actionable TODOs (one line each) so the user can quickly pick which ones to implement — or say "all".

## Fix Plan

If the review found any issues, create a markdown plan file (in `.claude/plans/`) that lists every issue as an actionable fix step — grouped by severity, with file paths, quoted problematic code, and the proposed fix. This allows the user to review all fixes at a glance and say "all" to apply them. Delete the plan file after all fixes have been implemented.
