/**
 * Per-username login throttle for the login server action.
 *
 * Extracted from the action and given an injected clock so the eviction policy
 * can be unit-tested: it is an unauthenticated write path, and the guarantee it
 * claims (a live lockout cannot be bought) is not obvious from reading it.
 */

export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 60_000;
// Upper bound on tracked usernames. The key is attacker-chosen, so without a cap
// an unauthenticated client grows this map without limit.
export const MAX_TRACKED = 1000;

interface Attempt {
  count: number;
  resetAt: number;
}

export interface LoginRateLimit {
  /** True while this name has spent its attempts inside the current window. */
  isLimited(username: string, now: number): boolean;
  recordFailure(username: string, now: number): void;
  clear(username: string): void;
  /** Introspection only, no production caller: it exists so the tests can assert
   *  the MAX_TRACKED cap directly instead of inferring it from behaviour. */
  tracked(): number;
}

export function createLoginRateLimit(): LoginRateLimit {
  const attempts = new Map<string, Attempt>();
  // Set when the table is full of locked-out names, i.e. when a failure cannot
  // be recorded at all. Until it passes, untracked names are refused instead of
  // waved through — see isLimited. Every entry that caused the saturation
  // expires within one window, so this clears itself.
  let saturatedUntil = 0;

  function sweepExpired(now: number): void {
    for (const [name, entry] of attempts) {
      if (now >= entry.resetAt) {
        attempts.delete(name);
      }
    }
  }

  /**
   * Frees a slot for one new entry and reports whether there is now room. Runs
   * only at the cap, so the common path stays O(1).
   *
   * Eviction goes by **lowest counter first**, oldest only as the tiebreak, and
   * skips anything already locked out. Age alone is the wrong key: `resetAt` is
   * never extended, so the account under attack is always among the oldest, and
   * evicting by age would reset its counter for the price of one junk name.
   * The guarantees this is meant to hold are pinned in loginRateLimit.test.ts.
   */
  function makeRoom(now: number): boolean {
    if (attempts.size < MAX_TRACKED) {
      return true;
    }

    sweepExpired(now);

    if (attempts.size < MAX_TRACKED) {
      return true;
    }

    let evictable: string | null = null;
    let lowestCount = Number.POSITIVE_INFINITY;
    let earliest = Number.POSITIVE_INFINITY;

    for (const [name, entry] of attempts) {
      if (entry.count >= MAX_ATTEMPTS) {
        continue;
      }

      const better = entry.count < lowestCount
        || (entry.count === lowestCount && entry.resetAt < earliest);

      if (better) {
        lowestCount = entry.count;
        earliest = entry.resetAt;
        evictable = name;
      }
    }

    if (evictable === null) {
      saturatedUntil = now + WINDOW_MS;
      return false;
    }

    attempts.delete(evictable);
    return true;
  }

  return {
    isLimited(username: string, now: number): boolean {
      const entry = attempts.get(username);

      // Untracked. Normally free to try — but not while the table is saturated:
      // there would be no slot to record a failure in, so an untracked name
      // could otherwise guess without limit. Refusing instead means every
      // unknown name is turned away for up to one window, so this trades
      // availability for the account. The price is deliberate: reaching
      // saturation costs MAX_TRACKED * MAX_ATTEMPTS = 5000 failed logins inside
      // 60s (~83/s), and each one already pays a full scrypt (~16 MB, ~50-100ms
      // — see lib/users.ts), so a client able to saturate this table is starving
      // the host of CPU either way. Failing closed adds no new capability, it
      // only declines to hand out free guesses on a machine already under water.
      //
      // Saturation is noticed lazily, on the first failure that cannot be
      // recorded, so one guess per window slips through before the refusal
      // engages. The alternative is an O(n) scan on every single login.
      if (entry === undefined) {
        return now < saturatedUntil;
      }

      return now < entry.resetAt && entry.count >= MAX_ATTEMPTS;
    },

    recordFailure(username: string, now: number): void {
      const entry = attempts.get(username);

      if (entry !== undefined && now < entry.resetAt) {
        entry.count++;
        return;
      }

      if (makeRoom(now)) {
        attempts.set(username, { count: 1, resetAt: now + WINDOW_MS });
      }
    },

    clear(username: string): void {
      attempts.delete(username);
    },

    tracked(): number {
      return attempts.size;
    },
  };
}
