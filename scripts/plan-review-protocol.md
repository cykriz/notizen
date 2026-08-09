This plan has not been reviewed automatically yet. Work through this procedure now — it does not replace
any step of your planning, it comes before it.

1. **Start the reviewer.** Agent `plan-reviewer` via the Agent tool, **synchronously**
   (`run_in_background: false`), `subagent_type: "plan-reviewer"`. The prompt contains exactly two things:
   - the plan path `{{PLAN_PATH}}`
   - the user's **verbatim** original request from this session — no summarising, no rephrasing, no
     additions of your own interpretation. The reviewer is meant to judge without bias whether the plan
     solves the question that was actually asked.

2. **Validate the findings yourself, don't adopt them.** The reviewer works in an empty context and can
   be wrong. For each finding: read the evidence (`file:line`), respect the `Confidence` field, and
   always verify `guess` yourself. Whatever does not hold gets dropped — with a reason.

3. **Fold the justified findings straight into the plan file.** You may edit the plan file in plan mode.
   Leave out cosmetics; only what genuinely makes the plan better or more correct.

4. **Decisions that belong to the user:** on `VERDICT: blocked`, or for `Q` questions that cannot be
   answered from the plan and the code, use `AskUserQuestion` — **before** `ExitPlanMode`. Anything you
   can decide yourself you decide yourself and record in the plan.

5. **Output to the user: about 8 lines maximum.** One header line `Auto review: N findings`, then one
   line per finding marked "adopted" (plus what changed in the plan) or "dropped" (plus the reason).
   Always show the dropped ones — that is the user's control over false positives.
   **No** review markdown, **no** code block, no tilde block, no table, no meta prose about hooks or
   about a tool having blocked you.

6. **Then call `ExitPlanMode` again.** The gate lets the call through, and the user gets their approval
   dialog as usual.

If the reviewer errors out or returns `VERDICT: failed`: once is enough — say so in one line and call
`ExitPlanMode` again.
