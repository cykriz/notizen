---
description: Delegates the review of all uncommitted changes to the `review-changes` subagent
---

Delegate the review — **do not run it yourself**. The review logic deliberately lives outside the
main context, in the subagent.

1. **Primary path.** `Agent` tool, `subagent_type: review-changes`, `run_in_background: false`. Do not
   end the turn before the agent has answered. Prompt **exactly**:

   > Review all uncommitted changes (untracked, unstaged, staged) in this repo.

   Nothing beyond that — no context, no intent, no summary. The agent judges blind.

2. **Fallback**, and only then: the call fails with an unknown `subagent_type`. The
   agent registry is built at session start, a freshly created agent takes effect only after a
   restart. Then **exactly one** attempt with `subagent_type: general-purpose` and the prompt:

   > Read `.claude/agents/review-changes.md`; the body from the frontmatter onwards is YOUR
   > instruction set; you are read-only. Review all uncommitted changes (untracked, unstaged, staged)
   > in this repo.

   ⚠️ `general-purpose` **does** have Write/Edit — there the read-only promise hangs on the prompt
   alone. Prefer the primary path.

3. **Both paths failed** → report in one line. Do **not** review yourself as a substitute.

What happens with the findings is in `CLAUDE.md` § "Code Review (automatic)" — reporting contract
and runtime gates there, not here.
