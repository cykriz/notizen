/**
 * Line-level read layer for the session transcript (JSONL): turning text into typed lines and reading a
 * single line. Round boundaries live in `plan-review-round.ts`, the decision in `plan-review-gate.ts`.
 *
 * Every field is `.catch(undefined)`: otherwise zod discards the **entire** line as soon as one field is
 * `null` (`z.string().optional()` rejects `null`). Dropping the line that holds the reviewer start would
 * leave `ExitPlanMode` denied forever — a deadlock through the back door.
 */
import { z } from 'zod';

const PLAN_MODE_ATTACHMENT = 'plan_mode';
const USER_LINE = 'user';
const ASSISTANT_LINE = 'assistant';
const HUMAN_ORIGIN = 'human';

const contentPartSchema = z.object({
  type: z.string().optional().catch(undefined),
  name: z.string().optional().catch(undefined),
  id: z.string().optional().catch(undefined),
  tool_use_id: z.string().optional().catch(undefined),
  input: z
    .object({ subagent_type: z.string().optional().catch(undefined) })
    .optional()
    .catch(undefined),
});

const transcriptLineSchema = z.object({
  type: z.string().optional().catch(undefined),
  isMeta: z.boolean().optional().catch(undefined),
  origin: z
    .object({ kind: z.string().optional().catch(undefined) })
    .optional()
    .catch(undefined),
  timestamp: z.string().optional().catch(undefined),
  attachment: z
    .object({
      type: z.string().optional().catch(undefined),
      planFilePath: z.string().optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
  message: z
    .object({ content: z.array(z.unknown()).optional().catch(undefined) })
    .optional()
    .catch(undefined),
});

export type ContentPart = z.infer<typeof contentPartSchema>;
export type TranscriptLine = z.infer<typeof transcriptLineSchema>;

/** Splits a JSONL transcript. Unreadable lines are dropped silently. */
export function parseTranscript(text: string): TranscriptLine[] {
  const lines: TranscriptLine[] = [];

  for (const raw of text.split('\n')) {
    if (raw.trim().length === 0) {
      continue;
    }

    try {
      const json: unknown = JSON.parse(raw);
      const result = transcriptLineSchema.safeParse(json);

      if (result.success) {
        lines.push(result.data);
      }
    } catch {
      // Half-written line at the end of the file etc. — skip it, don't fail.
    }
  }

  return lines;
}

/**
 * Content parts of a conversation line; individual broken parts are skipped instead of losing the line.
 *
 * Only `user` and `assistant` lines are conversation. Other line types (e.g. `api-request-blob`) replay
 * earlier messages without a timestamp: reading those copies moved the anchor onto an old `ExitPlanMode`
 * result, the round start became `null`, and every `ExitPlanMode` was denied for the rest of the session.
 * A missing/invalid `type` still passes (see the `.catch(undefined)` note at the top): dropping such a line
 * could hide the reviewer start and deny forever.
 */
export function contentParts(line: TranscriptLine): ContentPart[] {
  if (line.type !== undefined && line.type !== USER_LINE && line.type !== ASSISTANT_LINE) {
    return [];
  }

  const content = line.message?.content;

  if (content === undefined) {
    return [];
  }

  const parts: ContentPart[] = [];

  for (const raw of content) {
    const result = contentPartSchema.safeParse(raw);

    if (result.success) {
      parts.push(result.data);
    }
  }

  return parts;
}

/**
 * The plan mode reminder carries the plan path as structured data — no regex over free text, no guessing
 * through the global `~/.claude/plans/` that holds every project's plans. Its `planExists` field is
 * deliberately **not** used: a snapshot from when the reminder was written, repeated across rounds and
 * wrong in both directions (measured: `false` for a path that existed the day before).
 */
export function findPlanFilePath(lines: TranscriptLine[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const attachment = lines[i].attachment;

    if (attachment?.type !== PLAN_MODE_ATTACHMENT) {
      continue;
    }

    const planFilePath = attachment.planFilePath;

    if (planFilePath === undefined || planFilePath.length === 0) {
      continue;
    }

    return planFilePath;
  }

  return null;
}

/**
 * A real user turn. Several harness-written lines also carry `type: "user"` and must not start a round:
 * - `tool_result` lines;
 * - `isMeta` lines (injected system reminders);
 * - lines whose `origin.kind` is not `human` — above all `task-notification`, written when a background
 *   subagent finishes. Counting it moved the anchor past a background `plan-reviewer` start, so the review
 *   never counted for its round and `ExitPlanMode` stayed denied.
 *
 * A missing `origin` still counts as a user turn: older transcripts don't write it, and over-gating is the
 * safe direction there. An unknown future `origin.kind` does not count: the anchor then stays earlier, which
 * errs toward letting the plan through (fail-open), never toward a deadlock.
 */
export function isUserTurn(line: TranscriptLine): boolean {
  if (line.type !== USER_LINE || line.isMeta === true) {
    return false;
  }

  const originKind = line.origin?.kind;

  if (originKind !== undefined && originKind !== HUMAN_ORIGIN) {
    return false;
  }

  return !contentParts(line).some((part) => part.type === 'tool_result');
}
