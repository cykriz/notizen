---
description: Review Next.js code for bugs, performance, and best practices
---

Review the current unstaged and untracked changes in the Next.js codebase as an experienced Next.js senior developer — with a critical eye for redundancy and over-complexity, not only correctness.

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

### Redundancy & Simplicity

Analyze this as a senior dev would — is the change as simple as it could be, and does it avoid repeating what already exists?

- Reuse over re-implementation: does new code duplicate an existing hook, util, or component? Name the one to call instead
- Duplication: copy-pasted blocks (often with slight variation) that should be a single shared helper/component
- Redundant or derivable state: values held in state/refs/props that could be computed from what's already there
- Unnecessary complexity: deep nesting, needless indirection or abstraction, premature generalization, options nobody uses
- Dead weight: unused exports, props, variables, imports, or leftover commented-out code
- Right altitude: special cases layered on shared infrastructure where generalizing the mechanism is cleaner; thin wrappers that don't earn their keep

### Style & Conventions

- PascalCase components, camelCase utils, kebab-case routes
- Page-specific components co-located inside the route folder
- No unused imports, dead code, or commented-out blocks

## Output Format

Keep the text before the copyable fix plan as short as possible. No prose, no code quotes, no severity headings, no introduction. The details belong exclusively in the copyable plan.

If there are no findings: say so in **one** line and stop.

Otherwise: output only a compact list — **one line per item** that should be changed, in this form:

`- [severity] file: what to change — why, in plain words`

Rules:
- One line per finding. No code, no inline fixes, no paragraphs.
- Sorted by severity (Critical first, Minor last).
- Keep the "why" short and free of jargon.

## Copyable Fix Plan

If the review has findings, then output a markdown fix plan directly in the chat — do NOT write it to a file. Wrap the entire plan in ```` (four backticks) so that nested code blocks render correctly. This is where **all** the details belong: one actionable fix step per finding, grouped by severity, with file paths, quoted problem code, and a proposed fix. This lets the user review everything at a glance and say "all".
