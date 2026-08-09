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

/** Skip individual parts instead of losing the whole line. */
export function contentParts(line: TranscriptLine): ContentPart[] {
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

/** A real user turn — unlike the `tool_result` lines, which also carry `type: "user"`. */
export function isUserTurn(line: TranscriptLine): boolean {
  if (line.type !== 'user') {
    return false;
  }

  return !contentParts(line).some((part) => part.type === 'tool_result');
}
