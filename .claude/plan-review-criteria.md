# Plan Review Criteria

The **plan-level layer** over `.claude/commands/review.md`. That file is the single source for the
duplication probes, the simplicity checks and the severity floors; this file says how to apply them to a
plan instead of a diff, and adds what only a plan can be judged on. Nothing is copied from it — a rule
written twice is the defect `/review` rates highest.

Two consumers:

- **`/plan-review`** (manual, fresh session) — turns every line below into a `✅/⚠️/❌/n/a` line in its
  copyable block.
- **Subagent `plan-reviewer`** (automatic in plan mode before `ExitPlanMode`) — reports **deviations
  only**, in the compact findings format from `.claude/agents/plan-reviewer.md`.

## How to run this review

1. **Read this file in full**, plus `.claude/commands/review.md` §§ "Step 1", "2a" and "Severity Floors".
   Not from memory. Ignore its § "2b" — see "Not Checkable at the Plan Level" below.
2. **Skills only as needed**, like `/review` Step 0: scan the `description` frontmatter of
   `.claude/skills/**/SKILL.md` and read only those skills in full that match the files the plan touches.
   `CLAUDE.md` if needed. Don't duplicate content — check it and point at it.
3. **Evidence, not assertions**: back every claim about the existing code with `Read`/`Grep` and cite it
   as `file:line`. Mark what you did not verify.

## Generic Quality

- ✅/⚠️/❌ Completeness & scope
- ✅/⚠️/❌ Assumptions stated explicitly
- ✅/⚠️/❌ Step order / dependencies clear
- ✅/⚠️/❌ Error and edge cases considered
- ✅/⚠️/❌ Verification/tests (unit: `bun test` with `bun:test`, point `NOTES_ROOT` at a temp dir, test pure FS/logic helpers; E2E: `bun run test:e2e` (Playwright); **no vitest/Jest**; after every change `bun run lint && bunx tsc --noEmit`)
- ✅/⚠️/❌ Rollback / reversibility
- ✅/⚠️/❌ Affected files named concretely

## Notes App / Project Invariants (✅/⚠️/❌/n/a)

The rules themselves live in `CLAUDE.md` and the skills — these lines are the checklist, not a second copy
of the rules. Read the source before judging a line.

- **Language** — user-facing text in German, recurring strings as constants (`CLAUDE.md`)
- **File limit** — max 200 lines per file, tests excepted (`CLAUDE.md`); does the plan split files that would grow past it?
- **Constants/types** — repeated literals → `lib/constants.ts`, types in `lib/types.ts` (`CLAUDE.md` § Code Rules)
- **No database** — filesystem only via `lib/fsNotes.ts`/`lib/fsTodos.ts`/`lib/fsShares.ts`, `NOTES_ROOT` as the root (`CLAUDE.md`, `architecture` skill)
- **Offline-first (PWA)** — does every new feature work offline, and are new routes/data accounted for in `worker/sw.ts`/`swStrategies.ts`/`swWarm.ts`? New navigable pages need offline behaviour (`CLAUDE.md`, `architecture` skill)
- **Service worker strategies** — per-request-type strategy and the SW message protocol stay consistent; `/share/` routes are never cached (`architecture` skill)
- **Auth/proxy** — new routes behind auth or deliberately registered as a public path; session cookie contract untouched (`proxy` skill)
- **Mutations/revalidation** — `revalidatePath()` after mutations, except on `dynamic = 'force-dynamic'` pages (`CLAUDE.md`)
- **Server actions / API** — `zod`-validated inputs, error shape `{ error: string }`, auth gate; no leaked data (`architecture` skill)
- **`'use client'`** — only where state/hooks/events require it; prefer server-side data fetching (`CLAUDE.md`, `/review` § "Next.js Specifics")
- **Styling tokens** — Tailwind only, semantic colors, no `dark:`, `cn()` object syntax, shadcn over raw HTML (`CLAUDE.md` § Style Rules, `styling` skill)
- **Packages** — no new package without updating the approved list; every import a direct dependency; no hand-written type shims (`CLAUDE.md`)
- **Tags** — hierarchical, slash-separated (`CLAUDE.md`)
- **Next.js config** — no experimental features beyond the documented exception; `output: 'standalone'` stays (`CLAUDE.md`)
- **Conventions** — PascalCase components, camelCase utils, kebab-case routes, page-specific components in the route folder (`CLAUDE.md`)

Mark invariants that don't apply as `n/a` instead of omitting them.

## Duplication & Simplicity (Plan Level)

Run probes 1–6 from `.claude/commands/review.md` § "Step 1" and every check from its § "2a" against what
the plan **intends to do** rather than against a diff. Give each one a `✅/⚠️/❌/n/a` line named after the
probe. They are **actively run** — grep, read both sides. A probe you did not run must not be reported as
"found nothing".

What changes when the subject is a plan instead of a diff:

- **Extraction (probe 1)**: the tell is wording — "split out of", "moved to", or a new module whose
  exports mirror an existing file — with no sentence saying the original goes away.
- **Prior art (probe 3)**: grep for every new function/helper the plan proposes, by verb **and** by the
  thing it operates on. There is no diff to read, so this probe is the only thing standing between the
  plan and a re-implementation.
- **Cross-reference comments (probe 5)**: here it is the *plan's own* wording ("same as X", "mirrors Y"),
  not comments in finished code — for those see "Not Checkable at the Plan Level".
- **Mode parameters** (`/review` § 2b, "Boolean and mode parameters" — the one 2b check that *is*
  decidable on a plan): a new boolean/mode parameter that forks a function body. The plan must say how
  much of the body actually differs, or propose two functions.
- **Implicit ordering**: plan steps whose correctness depends on "must run before X" / "must stay
  synchronous" without the types enforcing it.
- **Skill inventory**: the plan adds modules/routes without accounting for the entry in
  `.claude/skills/architecture/SKILL.md` (or the matching skill).

## Severity

The floors in `.claude/commands/review.md` § "Severity Floors" apply verbatim; read them there.
`**High**/**Medium**/**Minor**` map to `high`/`medium`/`low`. Its nesting/decision-point floor does not
apply (see below). Minimums, not ceilings — raise them when the damage warrants it.

Plan-level additions:

- The plan breaks a project invariant, or is not implementable as written → **high**
- A gap that would surface in the code review at the latest (missing verification, open edge case) → **medium**

## Not Checkable at the Plan Level

These dimensions from `/review` § "2b" need finished code and remain the job of `/review`. **No** findings
are produced for them — guessing looks plausible and is wrong anyway:

nesting depth, number of decision points, live variables held at once, reading span, comment load (the
amount of explanatory prose in the code), naming of individual symbols.

The exception is "Boolean and mode parameters", which is decidable from a plan and is therefore listed
among the probes above.
