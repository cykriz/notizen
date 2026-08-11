import { describe, expect, it } from 'bun:test';
import { formatDate, formatDateTime, isOverdue, todayIso } from './utils';

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

describe('isOverdue', () => {
  const today = '2026-08-01';

  it('treats yesterday as overdue', () => {
    expect(isOverdue('2026-07-31', today)).toBe(true);
  });

  it('does not treat today as overdue', () => {
    expect(isOverdue(today, today)).toBe(false);
  });

  it('does not treat tomorrow as overdue', () => {
    expect(isOverdue('2026-08-02', today)).toBe(false);
  });

  it('compares across year boundaries', () => {
    expect(isOverdue('2025-12-31', '2026-01-01')).toBe(true);
    expect(isOverdue('2026-01-01', '2025-12-31')).toBe(false);
  });

  it('defaults to the display-zone calendar day', () => {
    expect(isOverdue(todayIso())).toBe(false);
  });
});

describe('todayIso', () => {
  it('returns a zero-padded YYYY-MM-DD', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // The point of these two: the day is decided in the SAME zone formatDate renders
  // in. Reverting to the device zone (or to UTC) breaks them in any process TZ.
  it('rolls over to the next day once it is past midnight in Berlin', () => {
    // 20:00 in New York is already 02:00 the following day in Berlin.
    expect(todayIso(new Date('2026-08-01T20:00:00-04:00'))).toBe('2026-08-02');
  });

  it('stays on the UTC day when Berlin has not rolled over yet', () => {
    expect(todayIso(new Date('2026-08-01T09:00:00Z'))).toBe('2026-08-01');
  });

  it('agrees with formatDate on the same instant', () => {
    const instant = new Date('2026-01-15T23:30:00Z');
    const [year, month, day] = todayIso(instant).split('-');
    expect(formatDate(instant.toISOString())).toBe(`${day}.${month}.${year}`);
  });
});
