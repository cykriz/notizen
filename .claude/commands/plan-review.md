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
   - If `$ARGUMENTS` is not empty → treat it as a file path and read it with `Read`; that is the review
     input.
   - Otherwise → take the plan last mentioned/pasted in the chat, or the plan mode plan, as input.
   - If **no** plan can be found at all → ask once which plan to review, then stop.

2. **Load the criteria and follow the procedure (mandatory)**
   Work through § "How to run this review" at the top of `.claude/plan-review-criteria.md`: it defines what
   to read (including which sections of `.claude/commands/review.md`), which skills to load, and the
   evidence standard. Do not work from memory.

3. **Write the review** following the template below.

4. **Print it as ONE code block directly in the chat**, following the fence rule below. **No** other prose
   outside the block, **no** second code block — at most a single short line before it (e.g. "Here is the
   review to copy:").
   - **Never create a new file.** The review is only ever printed as a code block in the chat — no `Write`,
     no saving to `.md`/`.claude/plans/` or similar. Only the plan under review may be read (in step 1)
     via `Read`; nothing is written.

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

The review text is markdown itself and contains **backtick** fences (` ``` `, e.g. to quote code snippets
from the plan). Wrapping it in a backtick block would let the first inner ` ``` ` run close the block
early. Solution: wrap the outer block in **tilde fences (`~~~`)**.

In CommonMark, tilde and backtick fences are **independent**: a tilde block is closed **only** by a line
with at least as many **tildes** — backticks in the content **never** close it, no matter how many. That is
more robust and simpler than counting backtick runs, because review content practically never contains
tilde fences.

1. First assemble the **complete** review markdown.
2. Determine the **longest contiguous run of tildes N** within it (almost always 0).
3. Pick the fence length **F = max(N + 1, 4)** — default 4 tildes, so even the rare case of a 3-tilde run
   in the content is safely enclosed.
4. Print the **entire** review in exactly one fence: a line with F tildes (optionally followed directly by
   `markdown` as a language hint), then the review, then a line of its own with the same F tildes. Opening
   and closing fence have the same count.

**Never use backtick fences (` ``` `) for the outer block** — otherwise the first inner code fence breaks
it open. The outer block is **always** a tilde fence.
