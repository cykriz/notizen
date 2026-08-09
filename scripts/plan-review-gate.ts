#!/usr/bin/env bun
/**
 * Plan review gate — `PreToolUse` hook for `ExitPlanMode`.
 *
 * Blocks `ExitPlanMode` until the `plan-reviewer` subagent has checked the current plan, handing the
 * main agent the procedure from `plan-review-protocol.md` as the deny reason. Reading the transcript
 * lives in `plan-review-transcript.ts`.
 *
 * Two rules that are not negotiable:
 *
 * 1. **Never `permissionDecision: "allow"`.** That would skip the user's approval dialog and start
 *    the implementation without consent. The "all good" path is exit 0 with no stdout — the normal
 *    permission flow then takes over.
 * 2. **Fail open.** Any error (broken stdin, unreadable transcript) ends in exit 0 with no stdout and
 *    diagnostics on stderr. A non-zero exit would block `ExitPlanMode` permanently — exactly the
 *    deadlock this gate must avoid.
 *
 * Debug: `PLAN_REVIEW_GATE_DEBUG=/path/dump.jsonl` appends the raw hook payload to that file, so the
 * real field names can be inspected without a throwaway hook.
 */
import { appendFileSync, statSync } from 'node:fs';

import { z } from 'zod';

import { roundReviewState } from './plan-review-round';
import { type TranscriptLine, findPlanFilePath, parseTranscript } from './plan-review-transcript';

const PLAN_PATH_PLACEHOLDER = '{{PLAN_PATH}}';
const PROTOCOL_FILE = 'plan-review-protocol.md';

const hookInputSchema = z.object({
  agent_id: z.string().optional(),
  transcript_path: z.string().optional(),
});

export type HookInput = z.infer<typeof hookInputSchema>;

export type Decision = { kind: 'skip' } | { kind: 'deny'; planFilePath: string };

/** Whether a plan needs a review. Injected so `decide` stays testable without a filesystem. */
export type PlanFileCheck = (
  planFilePath: string,
  everReviewed: boolean,
  roundStartTs: string | null,
) => boolean;

/**
 * The gate only fires when **both** proofs are missing — either one on its own lets the call through:
 *
 * - a `plan-reviewer` run **since the anchor** (start of the round) — this guarantees termination: the
 *   main agent patches the plan after the review, which must not trigger a second deny.
 * - the plan **was reviewed at some point and was not written during this round** — this guarantees
 *   correctness across rounds: when plan mode is re-entered, the previous round's plan file is still on
 *   disk, and reviewing that instead of the question actually being asked is worse than not reviewing.
 *   A plan that was never reviewed is always gated.
 *
 * Known gap: if the plan is written in one round, the user then *interrupts* with a new message, and
 * `ExitPlanMode` is called in the next round without touching the plan, that revision slips through as
 * long as some earlier review exists. It takes a real interruption — `AskUserQuestion` produces a
 * `tool_result`, which does not move the anchor — so it is left uncovered rather than paid for with a
 * timestamp-to-round mapping.
 */
export function decide(
  input: HookInput,
  lines: TranscriptLine[],
  planFileCheck: PlanFileCheck,
): Decision {
  // Called from inside a subagent — don't gate.
  if (input.agent_id !== undefined) {
    return { kind: 'skip' };
  }

  const planFilePath = findPlanFilePath(lines);

  // Not in plan mode: nothing to review.
  if (planFilePath === null) {
    return { kind: 'skip' };
  }

  const { reviewedThisRound, everReviewed, roundStartTs } = roundReviewState(lines);

  if (reviewedThisRound) {
    return { kind: 'skip' };
  }

  if (!planFileCheck(planFilePath, everReviewed, roundStartTs)) {
    return { kind: 'skip' };
  }

  return { kind: 'deny', planFilePath };
}

/**
 * An empty or missing plan is nothing a review could apply to (research session). Otherwise what counts
 * is whether the plan was written during the current round — measured against the round start, not
 * against the reviewer's start (see `wasEverReviewed`).
 */
export function planNeedsReview(
  planFilePath: string,
  everReviewed: boolean,
  roundStartTs: string | null,
): boolean {
  const stats = statSync(planFilePath, { throwIfNoEntry: false });

  if (stats === undefined || !stats.isFile() || stats.size === 0) {
    return false;
  }

  if (!everReviewed) {
    return true;
  }

  // No or unparseable round start: `NaN` would make every comparison `false` and silently disable the
  // gate, so review instead of waving the plan through.
  const roundStart = roundStartTs === null ? Number.NaN : Date.parse(roundStartTs);

  if (Number.isNaN(roundStart)) {
    return true;
  }

  return stats.mtimeMs > roundStart;
}

export function denyPayload(protocol: string, planFilePath: string): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: protocol.replaceAll(PLAN_PATH_PLACEHOLDER, planFilePath),
    },
    suppressOutput: true,
  });
}

async function main(): Promise<void> {
  const stdin = await Bun.stdin.text();
  const debugPath = process.env.PLAN_REVIEW_GATE_DEBUG;
  const debug = debugPath !== undefined && debugPath.length > 0 ? debugPath : null;

  if (debug !== null) {
    appendFileSync(debug, `${stdin.trim()}\n`);
  }

  const json: unknown = JSON.parse(stdin);
  const input = hookInputSchema.parse(json);
  const transcriptPath = input.transcript_path;

  if (transcriptPath === undefined || transcriptPath.length === 0) {
    return;
  }

  const lines = parseTranscript(await Bun.file(transcriptPath).text());
  const decision = decide(input, lines, planNeedsReview);

  // A silent pass and a broken gate look identical from the outside — so log which one it was.
  if (debug !== null) {
    appendFileSync(debug, `${JSON.stringify({ decision, planFilePath: findPlanFilePath(lines) })}\n`);
  }

  if (decision.kind === 'skip') {
    return;
  }

  const protocol = await Bun.file(`${import.meta.dir}/${PROTOCOL_FILE}`).text();

  process.stdout.write(`${denyPayload(protocol, decision.planFilePath)}\n`);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    // Fail open: a skipped review beats a blocked plan mode.
    console.error('[plan-review-gate]', error);
  }
}
