import { afterAll, describe, expect, test } from 'bun:test';

import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { decide, denyPayload, planNeedsReview } from './plan-review-gate';
import { findAnchorIndex, roundReviewState } from './plan-review-round';
import {
  type TranscriptLine,
  findPlanFilePath,
  isUserTurn,
  parseTranscript,
} from './plan-review-transcript';

const PLAN = '/Users/x/.claude/plans/my-plan.md';

/** Stubs for `decide`: "the plan needs a review" / "it doesn't". */
const NEEDS_REVIEW = () => true;
const NEEDS_NONE = () => false;

/**
 * Plan mode reminder as the transcript stores it. `planExists` is `false` here even though the plan
 * exists: the field is a snapshot from when the reminder was written and is wrong in both directions —
 * the gate must not rely on it.
 */
function planMode(planFilePath = PLAN): string {
  return JSON.stringify({
    type: 'attachment',
    attachment: { type: 'plan_mode', planFilePath, planExists: false, isSubAgent: false },
  });
}

function userTurn(text = 'build me this'): string {
  return JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text }] } });
}

function agentCall(subagentType: string, timestamp?: string): string {
  return JSON.stringify({
    type: 'assistant',
    timestamp,
    message: {
      content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: subagentType } }],
    },
  });
}

function exitPlanModeCall(id: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'ExitPlanMode', id }] },
  });
}

function toolResult(toolUseId: string, content = 'ok'): string {
  return JSON.stringify({
    type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: toolUseId, content }] },
  });
}

function transcript(...lines: string[]): TranscriptLine[] {
  return parseTranscript(lines.join('\n'));
}

describe('parseTranscript', () => {
  test('skips empty and broken lines without throwing', () => {
    const lines = parseTranscript(['', '{broken', '   ', userTurn(), '{"unexpected":true}'].join('\n'));

    expect(lines).toHaveLength(2);
  });

  test('tolerates a truncated last line', () => {
    const lines = parseTranscript(`${userTurn()}\n${planMode().slice(0, 30)}`);

    expect(lines).toHaveLength(1);
  });

  test('a null field does not drop the line', () => {
    const raw = JSON.stringify({
      type: null,
      timestamp: null,
      attachment: null,
      message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: 'plan-reviewer' } }] },
    });
    const lines = parseTranscript(raw);

    expect(lines).toHaveLength(1);
    expect(roundReviewState(lines).everReviewed).toBe(true);
  });

  test('a non-object content part does not drop the line', () => {
    const raw = JSON.stringify({
      type: 'assistant',
      message: {
        content: ['text', 42, null, { type: 'tool_use', name: 'Agent', input: { subagent_type: 'plan-reviewer' } }],
      },
    });

    expect(roundReviewState(parseTranscript(raw)).everReviewed).toBe(true);
  });

  test('tolerates message.content being a string instead of an array', () => {
    const lines = parseTranscript(JSON.stringify({ type: 'user', message: { content: 'text' } }));

    expect(lines).toHaveLength(1);
    expect(isUserTurn(lines[0])).toBe(true);
  });
});

describe('findPlanFilePath', () => {
  test('takes the last plan_mode entry', () => {
    const lines = transcript(planMode('/first.md'), userTurn(), planMode('/second.md'));

    expect(findPlanFilePath(lines)).toBe('/second.md');
  });

  test('returns null without a plan_mode entry', () => {
    expect(findPlanFilePath(transcript(userTurn()))).toBeNull();
  });
});

describe('isUserTurn', () => {
  test('recognises a real user turn', () => {
    expect(isUserTurn(transcript(userTurn())[0])).toBe(true);
  });

  test('does not count a tool_result line as a user turn', () => {
    expect(isUserTurn(transcript(toolResult('toolu_1'))[0])).toBe(false);
  });
});

describe('findAnchorIndex', () => {
  test('points at the last real user turn', () => {
    const lines = transcript(userTurn(), agentCall('Explore'), toolResult('toolu_9'));

    expect(findAnchorIndex(lines)).toBe(0);
  });

  test('moves past the tool_result of an ExitPlanMode attempt', () => {
    const lines = transcript(
      userTurn(),
      exitPlanModeCall('toolu_exit'),
      toolResult('toolu_exit', 'rejected'),
    );

    expect(findAnchorIndex(lines)).toBe(2);
  });

  test('ignores tool_results of other tools', () => {
    const lines = transcript(userTurn(), exitPlanModeCall('toolu_exit'), toolResult('toolu_read'));

    expect(findAnchorIndex(lines)).toBe(0);
  });

  test('the current ExitPlanMode call does not become its own anchor', () => {
    const lines = transcript(userTurn(), agentCall('plan-reviewer'), exitPlanModeCall('toolu_exit'));

    expect(findAnchorIndex(lines)).toBe(0);
    expect(roundReviewState(lines).reviewedThisRound).toBe(true);
  });

  test('returns -1 for a transcript without an anchor', () => {
    expect(findAnchorIndex(transcript(agentCall('Explore')))).toBe(-1);
  });
});

describe('roundReviewState', () => {
  test('a reviewer start after the anchor counts for this round', () => {
    const state = roundReviewState(transcript(userTurn(), agentCall('plan-reviewer')));

    expect(state).toMatchObject({ reviewedThisRound: true, everReviewed: true });
  });

  test('a reviewer start before the anchor counts only as everReviewed', () => {
    const state = roundReviewState(transcript(agentCall('plan-reviewer'), userTurn()));

    expect(state).toMatchObject({ reviewedThisRound: false, everReviewed: true });
  });

  test('does not mistake other subagents for the reviewer', () => {
    const state = roundReviewState(transcript(userTurn(), agentCall('Explore'), agentCall('Plan')));

    expect(state).toMatchObject({ reviewedThisRound: false, everReviewed: false });
  });

  test('a tool_use with the reviewer subagent_type but another tool name does not count', () => {
    const raw = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Task', input: { subagent_type: 'plan-reviewer' } }] },
    });

    expect(roundReviewState(parseTranscript(raw)).everReviewed).toBe(false);
  });

  test('reports the anchor line timestamp as the round start', () => {
    const lines = transcript(
      JSON.stringify({
        type: 'user',
        timestamp: '2026-08-03T14:36:00.000Z',
        message: { content: [{ type: 'text', text: 'go' }] },
      }),
      agentCall('Explore'),
    );

    expect(roundReviewState(lines).roundStartTs).toBe('2026-08-03T14:36:00.000Z');
  });

  test('round start is null without an anchor or without a timestamp', () => {
    expect(roundReviewState(transcript(agentCall('Explore'))).roundStartTs).toBeNull();
    expect(roundReviewState(transcript(userTurn())).roundStartTs).toBeNull();
  });
});

describe('planNeedsReview', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plan-review-'));
  const plan = join(dir, 'plan.md');

  writeFileSync(plan, '# Plan\n');

  /** Pins the plan file's mtime to a fixed point in time. */
  function setMtime(iso: string): void {
    const seconds = Date.parse(iso) / 1000;

    utimesSync(plan, seconds, seconds);
  }

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('never reviewed: review needed regardless of the round start', () => {
    setMtime('2026-08-01T10:00:00.000Z');

    expect(planNeedsReview(plan, false, '2026-08-03T10:00:00.000Z')).toBe(true);
  });

  test('plan written during this round: review needed', () => {
    setMtime('2026-08-03T14:40:00.000Z');

    expect(planNeedsReview(plan, true, '2026-08-03T14:36:00.000Z')).toBe(true);
  });

  test('plan older than the round start: no review needed', () => {
    setMtime('2026-08-01T10:00:00.000Z');

    expect(planNeedsReview(plan, true, '2026-08-03T14:36:00.000Z')).toBe(false);
  });

  test('patched right after its own review, but before this round: no review needed', () => {
    // The regression this signature exists for: the main agent folds findings in *after* the reviewer
    // starts, so comparing against the reviewer's start would deny here forever.
    setMtime('2026-08-01T10:03:00.000Z');

    expect(planNeedsReview(plan, true, '2026-08-03T14:36:00.000Z')).toBe(false);
  });

  test('a missing round start leads to a review, not a silent skip', () => {
    setMtime('2026-08-01T10:00:00.000Z');

    expect(planNeedsReview(plan, true, null)).toBe(true);
  });

  test('an unparseable round start leads to a review, not a silent skip', () => {
    setMtime('2026-08-01T10:00:00.000Z');

    expect(planNeedsReview(plan, true, 'not-a-date')).toBe(true);
  });

  test('missing file: no review needed', () => {
    expect(planNeedsReview(join(dir, 'does-not-exist.md'), false, null)).toBe(false);
  });

  test('empty file: no review needed', () => {
    const empty = join(dir, 'empty.md');

    writeFileSync(empty, '');

    expect(planNeedsReview(empty, false, null)).toBe(false);
  });

  test('a directory is not a plan', () => {
    expect(planNeedsReview(dir, false, null)).toBe(false);
  });
});

describe('decide', () => {
  test('new plan, never reviewed → deny', () => {
    const decision = decide({}, transcript(planMode(), userTurn()), NEEDS_REVIEW);

    expect(decision).toEqual({ kind: 'deny', planFilePath: PLAN });
  });

  test('does not rely on planExists from the attachment', () => {
    expect(decide({}, transcript(planMode(), userTurn()), NEEDS_REVIEW).kind).toBe('deny');
  });

  test('review ran this round, plan patched afterwards → skip (terminates)', () => {
    const lines = transcript(planMode(), userTurn(), agentCall('plan-reviewer'));

    // The plan was touched after the review — still no second deny.
    expect(decide({}, lines, NEEDS_REVIEW).kind).toBe('skip');
  });

  test('re-entry, previous round plan reviewed there and untouched → skip', () => {
    const lines = transcript(planMode(), agentCall('plan-reviewer'), userTurn());

    expect(decide({}, lines, NEEDS_NONE).kind).toBe('skip');
  });

  test('re-entry, previous round plan never reviewed → deny', () => {
    const lines = transcript(planMode(), userTurn());

    expect(decide({}, lines, NEEDS_REVIEW).kind).toBe('deny');
  });

  test('re-entry, plan written during this round → deny', () => {
    const lines = transcript(planMode(), agentCall('plan-reviewer'), userTurn());

    expect(decide({}, lines, NEEDS_REVIEW).kind).toBe('deny');
  });

  test('no plan written (research) → skip', () => {
    expect(decide({}, transcript(planMode(), userTurn()), NEEDS_NONE).kind).toBe('skip');
  });

  test('skip when called from inside a subagent', () => {
    const lines = transcript(planMode(), userTurn());

    expect(decide({ agent_id: 'sub_1' }, lines, NEEDS_REVIEW).kind).toBe('skip');
  });

  test('skip without a plan_mode entry', () => {
    expect(decide({}, transcript(userTurn()), NEEDS_REVIEW).kind).toBe('skip');
  });

  test('a rejection followed by a plan change is reviewed again', () => {
    const lines = transcript(
      planMode(),
      userTurn(),
      agentCall('plan-reviewer'),
      exitPlanModeCall('toolu_exit'),
      toolResult('toolu_exit', 'rejected'),
    );

    expect(decide({}, lines, NEEDS_REVIEW)).toEqual({ kind: 'deny', planFilePath: PLAN });
  });

  test('a rejection without a plan change needs no new review', () => {
    const lines = transcript(
      planMode(),
      userTurn(),
      agentCall('plan-reviewer'),
      exitPlanModeCall('toolu_exit'),
      toolResult('toolu_exit', 'rejected'),
    );

    expect(decide({}, lines, NEEDS_NONE).kind).toBe('skip');
  });
});

describe('decide with the real planNeedsReview', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plan-review-decide-'));
  const plan = join(dir, 'plan.md');

  writeFileSync(plan, '# Plan\n');

  function setMtime(iso: string): void {
    const seconds = Date.parse(iso) / 1000;

    utimesSync(plan, seconds, seconds);
  }

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** Round 1 reviews and patches the plan, round 2 opens with a fresh user turn. */
  function reEntry(): TranscriptLine[] {
    return transcript(
      planMode(plan),
      agentCall('plan-reviewer', '2026-08-01T10:00:00.000Z'),
      JSON.stringify({
        type: 'user',
        timestamp: '2026-08-03T14:36:00.000Z',
        message: { content: [{ type: 'text', text: 'new question, unrelated topic' }] },
      }),
    );
  }

  test('re-entry with the previous round plan patched after its review → skip', () => {
    setMtime('2026-08-01T10:03:00.000Z');

    expect(decide({}, reEntry(), planNeedsReview).kind).toBe('skip');
  });

  test('re-entry with a plan written in this round → deny', () => {
    setMtime('2026-08-03T14:40:00.000Z');

    expect(decide({}, reEntry(), planNeedsReview)).toEqual({ kind: 'deny', planFilePath: plan });
  });
});

describe('denyPayload', () => {
  test('substitutes the plan path at every occurrence', () => {
    const payload = denyPayload('first {{PLAN_PATH}}, then {{PLAN_PATH}}', PLAN);

    expect(payload).toContain(PLAN);
    expect(payload).not.toContain('{{PLAN_PATH}}');
  });

  test('never allows and suppresses the hook output', () => {
    const parsed: unknown = JSON.parse(denyPayload('text', PLAN));

    expect(parsed).toMatchObject({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny' },
      suppressOutput: true,
    });
    expect(denyPayload('text', PLAN)).not.toContain('"allow"');
  });
});
