import { z } from 'zod/v4';
import { QUADRANT, QUADRANT_KEYS } from './constants';
import type { TodoQuadrant } from './types';

// Own module rather than another entry in lib/constants.ts, which is at its
// 200-line cap. Both entry points for todo data reach it: the client cache/response
// parser (lib/schemas.ts) and the todos.json read layer (lib/fsTodosStore.ts).

// Two retirements, both without a data migration, so old rows still carry the old
// values:
//   'delegate' — cd9392c renamed the persisted Eingang value to 'inbox' (a 1:1 rename).
//   'schedule' / 'planned' — the Einplanen and Eingeplant columns are gone. This one
//   is a MERGE, not a rename: terminable work belongs in the calendar, so both land
//   in Eingang and get re-decided at the next weekly ritual rather than being dropped.
const LEGACY_QUADRANT_ALIASES = new Map<string, TodoQuadrant>([
  ['delegate', QUADRANT.INBOX],
  ['schedule', QUADRANT.INBOX],
  ['planned', QUADRANT.INBOX],
]);

/**
 * Maps any stored quadrant value onto one the app can render.
 *
 * Retired values are rewritten; anything else unrecognised falls back to Eingang
 * rather than being dropped. Rescuing is the single answer to "what is an unknown
 * quadrant", applied at BOTH entry points so the cache and the server-rendered
 * first paint cannot disagree: todos.json is read through an unvalidated cast, so
 * a hand-edited or future value does reach the client, and a todo that renders in
 * no quadrant is worse than one that needs re-sorting. Eingang is the "needs
 * sorting" bucket — exactly what such a row needs.
 *
 * Because both paths normalise, consumers may index a per-quadrant record
 * directly instead of guarding every lookup.
 */
export function toUsableQuadrant(value: string): TodoQuadrant {
  const resolved = LEGACY_QUADRANT_ALIASES.get(value) ?? value;
  return (QUADRANT_KEYS as string[]).includes(resolved) ? (resolved as TodoQuadrant) : QUADRANT.INBOX;
}

/**
 * The retirement rule as a zod schema for REQUEST bodies. Both todo routes
 * validate `quadrant` through it.
 *
 * The offline outbox can hold payloads written before 'schedule'/'planned' were
 * retired, and lib/syncReplay.ts sends them verbatim. A strict enum answers those
 * with a 400, which parks the change in the failed-sync inspector for good — the
 * opposite of the rescue this module promises. Enforcing it server-side rather
 * than in the client's replay covers every writer: a second device, or a tab still
 * running a service-worker-cached bundle, neither of which a client fix reaches.
 *
 * Only the ALIASES are rewritten here, deliberately NOT toUsableQuadrant's
 * catch-all: a stored row is rescued because losing it is worse than re-sorting
 * it, but an incoming request has an author who can be told. Mapping every typo
 * onto Eingang would turn `quadrant: 'inbxo'` into a silent 201 writing the wrong
 * column, where the enum still answers 400.
 */
export const TodoQuadrantInputSchema = z.preprocess(
  (v) => (typeof v === 'string' ? (LEGACY_QUADRANT_ALIASES.get(v) ?? v) : v),
  z.enum(QUADRANT_KEYS),
);
