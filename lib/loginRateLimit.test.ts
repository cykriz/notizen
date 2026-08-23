import { describe, expect, it } from 'bun:test';
import {
  MAX_ATTEMPTS,
  MAX_TRACKED,
  WINDOW_MS,
  createLoginRateLimit,
} from './loginRateLimit';

const T0 = 1_000_000;

/** Spends `count` failures on one name at the same instant. */
function fail(
  limit: ReturnType<typeof createLoginRateLimit>,
  username: string,
  count: number,
  now = T0,
): void {
  for (let i = 0; i < count; i++) {
    limit.recordFailure(username, now);
  }
}

describe('createLoginRateLimit', () => {
  it('allows up to MAX_ATTEMPTS failures, then locks out', () => {
    const limit = createLoginRateLimit();
    fail(limit, 'simon', MAX_ATTEMPTS - 1);
    expect(limit.isLimited('simon', T0)).toBe(false);

    limit.recordFailure('simon', T0);
    expect(limit.isLimited('simon', T0)).toBe(true);
  });

  it('is silent about names it has never seen', () => {
    const limit = createLoginRateLimit();
    expect(limit.isLimited('unbekannt', T0)).toBe(false);
  });

  it('lets the lockout lapse once the window is over', () => {
    const limit = createLoginRateLimit();
    fail(limit, 'simon', MAX_ATTEMPTS);
    expect(limit.isLimited('simon', T0 + WINDOW_MS - 1)).toBe(true);
    expect(limit.isLimited('simon', T0 + WINDOW_MS)).toBe(false);
  });

  it('does not extend the window on further failures inside it', () => {
    const limit = createLoginRateLimit();
    fail(limit, 'simon', MAX_ATTEMPTS);
    limit.recordFailure('simon', T0 + WINDOW_MS - 1);
    expect(limit.isLimited('simon', T0 + WINDOW_MS)).toBe(false);
  });

  it('starts a fresh window after the old one lapsed', () => {
    const limit = createLoginRateLimit();
    fail(limit, 'simon', MAX_ATTEMPTS);
    const later = T0 + WINDOW_MS;
    fail(limit, 'simon', MAX_ATTEMPTS, later);
    expect(limit.isLimited('simon', later)).toBe(true);
  });

  it('clears the counter on a successful login', () => {
    const limit = createLoginRateLimit();
    fail(limit, 'simon', MAX_ATTEMPTS);
    limit.clear('simon');
    expect(limit.isLimited('simon', T0)).toBe(false);
    expect(limit.tracked()).toBe(0);
  });

  it('never tracks more than MAX_TRACKED names', () => {
    const limit = createLoginRateLimit();
    for (let i = 0; i < MAX_TRACKED * 2; i++) {
      limit.recordFailure(`junk-${String(i)}`, T0);
    }

    expect(limit.tracked()).toBeLessThanOrEqual(MAX_TRACKED);
  });

  it('reclaims slots from expired entries rather than refusing new names', () => {
    const limit = createLoginRateLimit();
    for (let i = 0; i < MAX_TRACKED; i++) {
      limit.recordFailure(`junk-${String(i)}`, T0);
    }

    const later = T0 + WINDOW_MS;
    fail(limit, 'simon', MAX_ATTEMPTS, later);
    expect(limit.isLimited('simon', later)).toBe(true);
  });

  it('does not let a flood of fresh names reset a climbing counter', () => {
    // The attack the eviction order exists for: `simon` is being brute-forced
    // and sits below the lockout; the attacker floods the map with junk names to
    // push `simon` out and get a fresh set of attempts.
    const limit = createLoginRateLimit();
    fail(limit, 'simon', MAX_ATTEMPTS - 1);

    for (let i = 0; i < MAX_TRACKED * 3; i++) {
      limit.recordFailure(`junk-${String(i)}`, T0 + 1);
    }

    // One more failure must be enough to lock `simon` out — i.e. the counter
    // survived the flood. Evicting by age would have reset it instead.
    limit.recordFailure('simon', T0 + 1);
    expect(limit.isLimited('simon', T0 + 1)).toBe(true);
  });

  it('never evicts a name that is already locked out', () => {
    const limit = createLoginRateLimit();
    fail(limit, 'simon', MAX_ATTEMPTS);

    for (let i = 0; i < MAX_TRACKED * 3; i++) {
      limit.recordFailure(`junk-${String(i)}`, T0 + 1);
    }

    expect(limit.isLimited('simon', T0 + 1)).toBe(true);
  });

  it('keeps the lockout when every tracked name is locked out', () => {
    const limit = createLoginRateLimit();
    fail(limit, 'simon', MAX_ATTEMPTS);
    for (let i = 0; i < MAX_TRACKED; i++) {
      fail(limit, `junk-${String(i)}`, MAX_ATTEMPTS, T0 + 1);
    }

    // Nothing evictable left: the new name goes untracked, but no existing
    // lockout is released to make room for it.
    expect(limit.isLimited('simon', T0 + 1)).toBe(true);
    expect(limit.tracked()).toBeLessThanOrEqual(MAX_TRACKED);
  });

  /** Fills the table with MAX_TRACKED locked-out names, so nothing is evictable. */
  function saturate(limit: ReturnType<typeof createLoginRateLimit>, now = T0): void {
    for (let i = 0; i < MAX_TRACKED; i++) {
      fail(limit, `junk-${String(i)}`, MAX_ATTEMPTS, now);
    }
  }

  it('refuses a name once its failure could not be recorded anywhere', () => {
    const limit = createLoginRateLimit();
    saturate(limit);

    // Saturation is noticed lazily, so one attempt still gets through …
    expect(limit.isLimited('simon', T0)).toBe(false);
    limit.recordFailure('simon', T0);

    // … and from then on the name is refused rather than guessing unthrottled.
    expect(limit.isLimited('simon', T0)).toBe(true);
    expect(limit.isLimited('andere', T0)).toBe(true);
  });

  it('stops refusing once the saturation window has passed', () => {
    const limit = createLoginRateLimit();
    saturate(limit);
    limit.recordFailure('simon', T0);

    expect(limit.isLimited('simon', T0 + WINDOW_MS - 1)).toBe(true);
    expect(limit.isLimited('simon', T0 + WINDOW_MS)).toBe(false);
  });

  it('does not refuse untracked names for a flood that is merely large', () => {
    // Only saturation with *locked-out* names refuses. A flood of single
    // failures is evictable, so a legitimate login must not be blocked by it.
    const limit = createLoginRateLimit();
    for (let i = 0; i < MAX_TRACKED * 2; i++) {
      limit.recordFailure(`junk-${String(i)}`, T0);
    }

    expect(limit.isLimited('simon', T0)).toBe(false);
  });

  it('evicts the lowest counter first, oldest only as a tiebreak', () => {
    const limit = createLoginRateLimit();
    // Oldest entry, but the highest counter below the lockout.
    fail(limit, 'climbing', MAX_ATTEMPTS - 1, T0);
    for (let i = 0; i < MAX_TRACKED - 1; i++) {
      limit.recordFailure(`junk-${String(i)}`, T0 + 1);
    }

    // Map is full; this insert must evict a junk entry, not 'climbing'.
    limit.recordFailure('neu', T0 + 2);
    limit.recordFailure('climbing', T0 + 2);
    expect(limit.isLimited('climbing', T0 + 2)).toBe(true);
  });
});
