# Plan Review Criteria

The **plan-level layer** over `.claude/review/` (`checks.md`, `duplication-probes.md`). Those two files are
the single source for the duplication probes, the simplicity checks and the severity floors; this file
says how to apply them to a plan instead of a diff, and adds what only a plan can be judged on. Nothing is copied from them — a rule
written twice is the defect `/review` rates highest.

Two consumers:

- **`/plan-review`** (manual, fresh session) — turns every line below into a `✅/⚠️/❌/n/a` line in its
  copyable block.
- **Subagent `plan-reviewer`** (automatic in plan mode before `ExitPlanMode`) — reports **deviations
  only**, in the compact findings format from `.claude/agents/plan-reviewer.md`.

Three parts are exempt from both rules — never a line copied verbatim, never deviations-only, always present:
**baseline**, **deletion inventory** and **simplicity line** (see "Duplication & Simplicity").

## How to run this review

1. **`CLAUDE.md` is already in your context** — judge against it and do **not** read it again. If it is
   missing there, report that as `Gap:`.
2. **Read this file in full**, plus `.claude/review/duplication-probes.md` § "Step 1" and
   `.claude/review/checks.md` §§ "2a", "2b", "Correctness & Bugs", "Severity Floors", "Next.js Specifics" and "Style & Conventions". Not from memory. Of "2b" and
   "Correctness & Bugs" apply only the one check each named below — see "Not Checkable at the Plan Level".
3. **Skills only as needed**: find the matching `SKILL.md` the same way `.claude/agents/review-changes.md`
   § 3 describes (`Grep` over `.claude/skills/**/SKILL.md` for `^description:`), then read **only** the
   matching skill — and from it only the reference file its routing table names for the paths the plan
   touches. Don't duplicate content — check it and point at it.
4. **Evidence, not assertions**: back every claim about the existing code with `Read`/`Grep` and cite it
   as `file:line`. Mark what you did not verify.
5. **No Bash here.** `checks.md` § "Style & Conventions" resolves a wrapper's class merge with `bun -e`;
   you cannot run it. Degrade, don't skip: read the wrapper's base classes, name the class group on both
   sides, and report only a mismatch legible without resolving — and say that you did not resolve it.

## Generic Quality

- ✅/⚠️/❌ Completeness & scope
- ✅/⚠️/❌ Assumptions stated explicitly
- ✅/⚠️/❌ Step order / dependencies clear
- ✅/⚠️/❌ Error and edge cases considered
- ✅/⚠️/❌ Verification/tests — does the plan name the commands its changes need, and do its unit tests meet the contract in `CLAUDE.md` § Commands? Layout changes additionally face the geometry bar in `checks.md` § "Style & Conventions".
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
- **Next.js config** — no experimental features beyond the documented exception (`CLAUDE.md`); `output: 'standalone'` stays (`next.config.ts`)
- **Conventions** — naming, co-location and the class-override probe for `components/ui/` wrappers (`checks.md` § "Style & Conventions")

Mark invariants that don't apply as `n/a` instead of omitting them.

## Duplication & Simplicity (Plan Level)

Run probes 1–6 from `.claude/review/duplication-probes.md` § "Step 1" and every check from `checks.md`
§ "2a" against what the plan **intends to do** rather than against a diff. Give each one a `✅/⚠️/❌/n/a`
line named after the probe. They are **actively run** — grep, read both sides. A probe you did not run must not be reported as
"found nothing".

What changes when the subject is a plan instead of a diff:

- **Deletion inventory** (§ "2a", runs first): over **every artifact the plan proposes**, reported in
  full rather than as a probe line.
- **Baseline:** name the smallest implementation that meets the *original request* — its mechanism in
  one clause, plus new files / new exports / changed files — and measure the plan against it. Every item
  above the baseline needs its own reason.
- **Special-case lists** (§ "2a"): also ask whether the stricter reading of the original request
  collapses them into one path.
- **Affordances that lie** (the one "Correctness & Bugs" check decidable on a plan): the UI a step
  describes shows what its handler writes.
- **Extraction (probe 1)**: the tell is wording — "split out of", "moved to", or a new module whose
  exports mirror an existing file — with no sentence saying the original goes away. In the reverse
  direction the tell is a plan that names the new shared helper and exactly one place that will call it —
  grep for the other copies yourself.
- **Prior art (probe 3)** — most often decides a plan's worth; there is no diff to read later. Run its
  nameless-code trigger and behaviour-keyed grep in full: on a plan that block is a snippet, a `useMemo`
  in an example, or three statements of prose — the easiest to read past.
- **Cross-reference comments (probe 5)**: here it is the *plan's own* wording ("same as X", "mirrors Y"),
  not comments in finished code — for those see "Not Checkable at the Plan Level".
- **Counts (probe 5)**: a plan's prose numbers about the *existing* code are claimed counts — re-run the
  grep and say what you re-counted; a count nobody re-ran asserts the plan's own completeness.
- **Mode parameters** (§ "2b", the one 2b check decidable on a plan): a new boolean/mode parameter that
  forks a body — the plan says how much differs, or proposes two functions.
- **Implicit ordering**: plan steps whose correctness depends on "must run before X" / "must stay
  synchronous" without the types enforcing it.
- **Skill inventory**: the plan adds modules/routes without accounting for the entry in the matching
  `.claude/skills/architecture/references/*.md` (routing table in that skill's `SKILL.md`), or the
  matching skill.

**Always answer "is this the simplest way?"** — once, as the aggregate, never as a checklist line. It
judges the **mechanism itself**, not only what sits inside it: whatever the answer, say whether the
chosen approach is needed at all, anchored on a `file:line` in the existing code rather than on the
plan's own reasoning. A `no` whose alternative keeps the plan's mechanism must say why no existing field
or function carries it; "the core is justified" followed by polish is not an answer. A `no` names the
concrete simpler alternative and is **also** a finding. Format per consumer:
`.claude/agents/plan-reviewer.md` § 4 and the template in `.claude/commands/plan-review.md`.

## Severity

The floors in `.claude/review/checks.md` § "Severity Floors" apply verbatim; read them there.
`**High**/**Medium**/**Minor**` map to `high`/`medium`/`low`. Its nesting/decision-point floor does not
apply (see below). Minimums, not ceilings — raise them when the damage warrants it.

Plan-level additions:

- The plan breaks a project invariant, or is not implementable as written → **high**
- The plan writes out logic that an existing function already performs → **high** (what counts is
  probe 3's business; this only raises the floor — the plan stage is the last cheap moment).
- A gap that would surface in the code review at the latest (missing verification, open edge case) → **medium**
- The simplicity line answers *no* → **high**
- **No `approve` while any inventory item has no named breakage** — even when everything else is clean

## Not Checkable at the Plan Level

These dimensions from `checks.md` § "2b" need finished code and remain the job of the code review. **No** findings
are produced for them — guessing looks plausible and is wrong anyway:

nesting depth, number of decision points, live variables held at once, reading span, comment load (the
amount of explanatory prose in the code), naming of individual symbols.

The exceptions are "Boolean and mode parameters" and "Affordances that lie", which are decidable from a
plan and are therefore listed among the probes above. The rest of § "Correctness & Bugs" is out likewise.
