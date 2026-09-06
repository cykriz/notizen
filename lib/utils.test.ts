import { describe, expect, it } from 'bun:test';
import { byUpdatedAtDesc, formatDate, formatDateTime } from './utils';

// The point of pinning timeZone is that these assertions hold no matter what TZ the
// process runs in — the container renders in UTC, the browser in local time, and the
// same markup has to come out of both. So no env fiddling here: setting process.env.TZ
// after startup does not reliably re-resolve Intl's zone in Bun.
describe('formatDate', () => {
  it('uses the Berlin calendar day, not UTC, across the day boundary', () => {
    // 23:30Z on 15 March is already 00:30 on 16 March in Berlin.
    expect(formatDate('2026-03-15T23:30:00Z')).toBe('16.03.2026');
  });

  it('keeps a mid-day timestamp on its own day', () => {
    expect(formatDate('2026-03-15T12:00:00Z')).toBe('15.03.2026');
  });

  it('renders a date-only value as that same calendar day', () => {
    // Parsed as UTC midnight; Berlin is always ahead of UTC, so the day is unchanged.
    expect(formatDate('2026-07-30')).toBe('30.07.2026');
  });
});

describe('formatDateTime', () => {
  it('shifts a late-evening UTC timestamp into the next Berlin day', () => {
    // CET in winter (UTC+1): 23:30Z -> 00:30 the following day.
    expect(formatDateTime('2026-01-15T23:30:00Z')).toBe('16.01.2026, 00:30');
  });

  it('applies summer time (UTC+2)', () => {
    expect(formatDateTime('2026-07-15T10:00:00Z')).toBe('15.07.2026, 12:00');
  });
});

describe('byUpdatedAtDesc', () => {
  const at = (updatedAt: string) => ({ updatedAt });

  it('orders the newest first', () => {
    const rows = [at('2026-01-01T00:00:00Z'), at('2026-03-01T00:00:00Z'), at('2026-02-01T00:00:00Z')];
    expect(rows.sort(byUpdatedAtDesc).map((r) => r.updatedAt.slice(0, 7))).toEqual([
      '2026-03',
      '2026-02',
      '2026-01',
    ]);
  });

  it('returns 0 for equal timestamps, so callers can chain a tiebreaker', () => {
    expect(byUpdatedAtDesc(at('2026-01-01T00:00:00Z'), at('2026-01-01T00:00:00Z'))).toBe(0);
  });

  it('compares the instant, not the string — differing offsets for the same moment tie', () => {
    expect(byUpdatedAtDesc(at('2026-01-01T12:00:00Z'), at('2026-01-01T14:00:00+02:00'))).toBe(0);
  });
});
