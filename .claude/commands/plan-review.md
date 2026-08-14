---
description: Reviews a plan (generic quality + Next.js/project invariants) and prints the result as ONE
  copyable markdown code block. Optional path argument; without one, the current/pasted plan in the chat
  is reviewed.
argument-hint: [plan_path]
allowed-tools: Read, Glob, Grep
---

# /plan-review

Reviews an implementation/work plan and prints the result **as exactly one copyable markdown code block**,
so it can be taken over in one piece via the copy button.

## Procedure

1. **Get the plan**
   - `$ARGUMENTS` not empty → treat it as a file path and `Read` it; that is the review input.
   - Otherwise → the plan last mentioned/pasted in the chat, or the plan mode plan.
   - If **no** plan can be found at all → ask once which plan to review, then stop.

2. **Load the criteria and follow the procedure (mandatory)**
   Work through § "How to run this review" at the top of `.claude/plan-review-criteria.md`: it defines what
   to read (including which sections of `.claude/review/checks.md`), which skills to load, and the
   evidence standard. Do not work from memory.

3. **Write the review** following the template below.

4. **Print it as ONE code block directly in the chat**, following the fence rule below. **No** other prose
   outside the block, **no** second code block — at most a single short line before it.
   - **Never create a new file.** The review is only ever printed as a code block in the chat — no `Write`,
     no saving to `.md`/`.claude/plans/` or similar. Only the plan under review may be read (in step 1).

## Review template (= content of the code block, in markdown)

```
# Plan review: <short title of the plan>

## Verdict
**Approve | Revise | Blocked** — <reasoning in 1–2 sentences>

## Strengths
- <what the plan does well>

## Generic Quality
<the lines of the "Generic Quality" section from `.claude/plan-review-criteria.md`, verbatim, prefix set per line>

## Notes App / Project Invariants (✅/⚠️/❌/n/a)
<the lines of the "Notes App / Project Invariants" section from `.claude/plan-review-criteria.md`, verbatim, prefix set per line>

## Duplication & Simplicity (✅/⚠️/❌/n/a)
<the probes from `.claude/plan-review-criteria.md`, verbatim, prefix set per line>

## Gaps & Risks
1. [high|medium|low] <problem> — Fix: <suggestion>

## Open Questions
- <what must be settled before implementation>
```

The three checklists do **not** live here but in `.claude/plan-review-criteria.md` — maintenance and
reconciliation with `/review` happen there. Copy the lines into the block verbatim and only replace the
prefix placeholder with your judgement. Mark lines that don't apply as `n/a` instead of omitting them.

## Fence rule — CORE REQUIREMENT: only ONE code block

The review text is markdown itself and contains **backtick** fences, so a backtick outer block would be
closed early by the first inner one. ⚠️ **Never use backtick fences (` ``` `) for the outer block** — it is
**always** a tilde fence, which in CommonMark only a line of ≥ as many tildes can close.

1. Assemble the **complete** review markdown first.
2. Determine the longest contiguous run of tildes **N** within it (almost always 0).
3. Fence length **F = max(N + 1, 4)**.
4. Print the **entire** review in exactly one fence: a line of F tildes (default `~~~~`, optionally
   followed directly by `markdown`), the review, then a line of its own with the same F tildes. Opening
   and closing match.
