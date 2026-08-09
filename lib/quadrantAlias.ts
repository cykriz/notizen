import { QUADRANT, QUADRANT_KEYS } from './constants';
import type { TodoQuadrant } from './types';

// Own module rather than another entry in lib/constants.ts, which is at its
// 200-line cap. Both entry points for todo data reach it: the client cache/response
// parser (lib/schemas.ts) and the todos.json read layer (lib/fsTodosStore.ts).

// cd9392c renamed the persisted Eingang value from 'delegate' to 'inbox' without
// shipping a data migration, so rows written before it still say 'delegate'.
const LEGACY_QUADRANT_ALIASES = new Map<string, TodoQuadrant>([
  ['delegate', QUADRANT.INBOX],
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
