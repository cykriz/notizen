# Plan Review Criteria

The **plan-level layer** over `.claude/review/checks.md`. That file is the single source for the
duplication probes, the simplicity checks and the severity floors; this file says how to apply them to a
plan instead of a diff, and adds what only a plan can be judged on. Nothing is copied from it — a rule
written twice is the defect `/review` rates highest.

Two consumers:

- **`/plan-review`** (manual, fresh session) — turns every line below **except the simplicity verdict**
  into a `✅/⚠️/❌/n/a` line in its copyable block.
- **Subagent `plan-reviewer`** (automatic in plan mode before `ExitPlanMode`) — reports **deviations
  only**, in the compact findings format from `.claude/agents/plan-reviewer.md`. The simplicity verdict
  below is the one exception, and it is unconditional.

## How to run this review

1. **`CLAUDE.md` is already in your context** — judge against it and do **not** read it again. If it is
   missing there, report that as `Lücke:`.
2. **Read this file in full**, plus `.claude/review/checks.md` §§ "Step 1", "2a", "Severity Floors",
   "Next.js Specifics" and "Style & Conventions" — every section this file points at. Not from memory.
   Ignore its § "2b" apart from the one check named below — see "Not Checkable at the Plan Level".
3. **Skills only as needed**: find the matching `SKILL.md` the same way `.claude/agents/review-changes.md`
   § 3 describes (`Grep` over `.claude/skills/**/SKILL.md` for `^description:`), then read **only** the
   matching skill — and from it only the reference file its routing table names for the paths the plan
   touches. Don't duplicate content — check it and point at it.
4. **Evidence, not assertions**: back every claim about the existing code with `Read`/`Grep` and cite it
   as `file:line`. Mark what you did not verify.

## Generic Quality

- ✅/⚠️/❌ Completeness & scope
- ✅/⚠️/❌ Assumptions stated explicitly
- ✅/⚠️/❌ Step order / dependencies clear
- ✅/⚠️/❌ Error and edge cases considered
- ✅/⚠️/❌ Verification/tests — does the plan name the commands its changes need (`CLAUDE.md` § Commands)? Unit tests point `NOTES_ROOT` at a temp dir and cover pure FS/logic helpers; **no vitest/Jest**
- ✅/⚠️/❌ Rollback / reversibility
- ✅/⚠️/❌ Affected files named concretely

## Notes App / Project Invariants (✅/⚠️/❌/n/a)

The rules live in `CLAUDE.md` (in your context) and in the skills — these lines are the checklist, not a
second copy. Where a line names files, those are the ones to look at; the rule itself you read at its source.

- **Language** — user-facing text and recurring strings (`CLAUDE.md` § Key Rules, § Code Rules)
- **File limit** — does the plan split files that would grow past the cap (`CLAUDE.md` § Key Rules)?
- **Constants/types** — `lib/constants.ts` / `lib/types.ts` (`CLAUDE.md` § Code Rules)
- **No database** — filesystem only via `lib/fsNotes.ts`/`lib/fsTodos.ts`/`lib/fsShares.ts`, `NOTES_ROOT` as the root (`CLAUDE.md`, `architecture` skill)
- **Offline-first (PWA)** — does every new feature work offline, and are new routes/data accounted for in `worker/sw.ts`/`worker/swStrategies.ts`/`worker/swWarm.ts`? New navigable pages need offline behaviour (`CLAUDE.md`, `architecture` skill)
- **Service worker strategies** — per-request-type strategy and the SW message protocol stay consistent; `/share/` routes are never cached (`architecture` skill)
- **Auth/proxy** — new routes behind auth or deliberately registered as a public path; session cookie contract untouched (`proxy` skill)
- **Mutations/revalidation** — `revalidatePath()` and its `dynamic = 'force-dynamic'` exception (`CLAUDE.md`)
- **Server actions / API** — `zod`-validated inputs, error shape `{ error: string }`, auth gate; no leaked data (`architecture` skill → `.claude/skills/architecture/references/routes.md`)
- **`'use client'`** — only where state/hooks/events require it; prefer server-side data fetching (`CLAUDE.md`, `checks.md` § "Next.js Specifics")
- **Styling tokens** — Tailwind, semantic colors, no `dark:`, `cn()` object syntax, shadcn over raw HTML (`CLAUDE.md` § Style Rules, `styling` skill)
- **Packages** — approved list, direct dependency, no hand-written type shims (`CLAUDE.md` § Key Rules, § Approved Packages)
- **Tags** — hierarchical, slash-separated (`CLAUDE.md`)
- **Next.js config** — no experimental features beyond the documented exception; `output: 'standalone'` stays (`CLAUDE.md`, `next.config.ts`)
- **Conventions** — naming and co-location (`checks.md` § "Style & Conventions")

Mark invariants that don't apply as `n/a` instead of omitting them.

## Duplication & Simplicity (Plan Level)

Run probes 1–6 from `.claude/review/checks.md` § "Step 1" and every check from its § "2a" against what
the plan **intends to do** rather than against a diff. Give each one a `✅/⚠️/❌/n/a` line named after the
probe. They are **actively run** — grep, read both sides. A probe you did not run must not be reported as
"found nothing".

What changes when the subject is a plan instead of a diff:

- **Extraction (probe 1)**: the tell is wording — "split out of", "moved to", or a new module whose
  exports mirror an existing file — with no sentence saying the original goes away. In the reverse
  direction the tell is a plan that names the new shared helper and exactly one place that will call it —
  grep for the other copies yourself.
- **Prior art (probe 3)** — the probe that most often decides whether a plan is worth anything, because
  there is no diff to read later. `checks.md` keys it on new exported **names** (function, type, schema);
  on a plan that trigger is too narrow and has already let a duplicate through. Widen it on all four counts:
  - **Trigger on any logic the plan spells out, not just on new names.** A plan that inlines its logic
    proposes no symbol to grep for — an effect body, a `useMemo`, a snippet inside a diff block, three
    statements in prose. A name-keyed probe skips all of it, and an anonymous block re-implementing a
    named function is exactly the case this review has missed before.
  - **Key the grep on behaviour, not on a name.** For every block the plan writes out, grep (a) each
    piece of state it writes — the setter, the store key, the file — and (b) each external read it makes
    (`getX()`, `localStorage`, `fetch`). Whoever already owns that state is nearly always an existing
    function; read it, then say whether the plan should call it instead of restating it.
  - **Look one level out.** The duplicate usually is not in the file the plan edits but in a sibling that
    already shares the state — the other hooks behind the same provider, the helper the caller uses.
  - **Report it even when the plan's version is shorter.** A short copy that silently drops a guard the
    original carries is more damaging than the duplication, not less.
- **Cross-reference comments (probe 5)**: here it is the *plan's own* wording ("same as X", "mirrors Y"),
  not comments in finished code — for those see "Not Checkable at the Plan Level".
- **Counts (probe 5)**: a plan's prose numbers about the *existing* code are the claimed counts probe 5
  sends you back to the grep for — on a diff you do the counting, here the plan did it for you. Say what
  you re-counted; a plan that rests on a count nobody re-ran is asserting its own completeness.
- **Mode parameters** (`checks.md` § "2b", "Boolean and mode parameters" — the one 2b check that *is*
  decidable on a plan): a new boolean/mode parameter that forks a function body. The plan must say how
  much of the body actually differs, or propose two functions.
- **Implicit ordering**: plan steps whose correctness depends on "must run before X" / "must stay
  synchronous" without the types enforcing it.
- **Skill inventory**: the plan adds modules/routes without accounting for the entry in the matching
  `.claude/skills/architecture/references/*.md` (routing table in that skill's `SKILL.md`), or the
  matching skill.

**Always answer "is this the simplest way?"** — the aggregate over the probes and § "2a", not a seventh
check and not a checklist line, so never copy it into a `✅/⚠️/❌` list. Both consumers close this
section with exactly **one** line of their own, on a `revise` with fifteen findings and on a clean
`approve` alike; when the answer is no it names the concrete simpler alternative (fewer layers, an
existing function, no new field) and is **also** a finding, so the verdict is then not `approve` —
without that it would be a deviation reported outside the findings list. Format per consumer:
`.claude/agents/plan-reviewer.md` § 4 and the template in `.claude/commands/plan-review.md`. Today the
question stays unanswered precisely when nobody objects, and silence is not a yes.

## Severity

The floors in `.claude/review/checks.md` § "Severity Floors" apply verbatim; read them there.
`**High**/**Medium**/**Minor**` map to `high`/`medium`/`low`. Its nesting/decision-point floor does not
apply (see below). Minimums, not ceilings — raise them when the damage warrants it.

Plan-level additions:

- The plan breaks a project invariant, or is not implementable as written → **high**
- The plan writes out logic that an existing function already performs → **high**, whether or not the plan
  gives it a name, and whether or not the plan's version is shorter. Once implemented this is a duplicate
  nobody asked for, and the plan stage is the last cheap moment to catch it.
- A gap that would surface in the code review at the latest (missing verification, open edge case) → **medium**
- The simplicity line answers *no* → **medium**, unless a stricter floor above already applies

## Not Checkable at the Plan Level

These dimensions from `checks.md` § "2b" need finished code and remain the job of the code review. **No** findings
are produced for them — guessing looks plausible and is wrong anyway:

nesting depth, number of decision points, live variables held at once, reading span, comment load (the
amount of explanatory prose in the code), naming of individual symbols.

The exception is "Boolean and mode parameters", which is decidable from a plan and is therefore listed
among the probes above.
