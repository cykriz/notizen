/**
 * Where the current plan mode round begins, and what happened inside it. Built on the line-level readers
 * in `plan-review-transcript.ts`; the decision it feeds lives in `plan-review-gate.ts`.
 */
import { type TranscriptLine, contentParts, isUserTurn } from './plan-review-transcript';

const REVIEWER_AGENT = 'plan-reviewer';
const AGENT_TOOL = 'Agent';
const EXIT_PLAN_MODE = 'ExitPlanMode';

function lastUserTurnIndex(lines: TranscriptLine[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isUserTurn(lines[i])) {
      return i;
    }
  }

  return -1;
}

/**
 * Anchored on the `tool_result`, not the `tool_use`: a result cannot exist yet while the hook runs, so the
 * current call cannot become its own anchor (that would be an endless loop).
 */
function lastCompletedExitPlanModeIndex(lines: TranscriptLine[]): number {
  const exitPlanModeIds = new Set<string>();
  let index = -1;

  for (let i = 0; i < lines.length; i++) {
    for (const part of contentParts(lines[i])) {
      const { id, tool_use_id: toolUseId } = part;

      if (part.type === 'tool_use' && part.name === EXIT_PLAN_MODE && id !== undefined) {
        exitPlanModeIds.add(id);
      }

      if (part.type === 'tool_result' && toolUseId !== undefined && exitPlanModeIds.has(toolUseId)) {
        index = i;
      }
    }
  }

  return index;
}

/** Start of the current round. One review from here on is enough — else every patch would re-gate. */
export function findAnchorIndex(lines: TranscriptLine[]): number {
  return Math.max(lastUserTurnIndex(lines), lastCompletedExitPlanModeIndex(lines));
}

/** The tool name matters: any other tool carrying a `subagent_type` must not pass as a review. */
function isReviewerStart(line: TranscriptLine): boolean {
  return contentParts(line).some(
    (part) =>
      part.type === 'tool_use' &&
      part.name === AGENT_TOOL &&
      part.input?.subagent_type === REVIEWER_AGENT,
  );
}

export interface RoundReviewState {
  /** A reviewer run since the anchor — proof that this round was reviewed. */
  reviewedThisRound: boolean;
  /** A reviewer run anywhere in the session. */
  everReviewed: boolean;
  /** Start of the current round; the plan file's mtime is compared against it. */
  roundStartTs: string | null;
}

/**
 * The three facts the gate needs about reviews, in one pass. `everReviewed` is a boolean rather than a
 * timestamp on purpose: that timestamp would be the reviewer's *start*, and findings get folded in
 * afterwards, so "plan newer than the review" is the normal state after any review that found something.
 */
export function roundReviewState(lines: TranscriptLine[]): RoundReviewState {
  const anchorIndex = findAnchorIndex(lines);
  const state: RoundReviewState = {
    reviewedThisRound: false,
    everReviewed: false,
    roundStartTs: anchorIndex < 0 ? null : lines[anchorIndex].timestamp ?? null,
  };

  for (let i = 0; i < lines.length; i++) {
    if (!isReviewerStart(lines[i])) {
      continue;
    }

    state.everReviewed = true;

    if (i > anchorIndex) {
      state.reviewedThisRound = true;
    }
  }

  return state;
}
