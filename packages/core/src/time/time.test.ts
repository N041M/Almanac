import { describe, it, expect } from 'vitest';
import {
  isValidISODate,
  toEpochDay,
  fromEpochDay,
  todayISO,
  addDays,
  diffDays,
  weekdayOf,
  startOfWeek,
  endOfWeek,
  addMonths,
  endOfMonth,
  createFixedClock,
} from './index.js';

describe('ISODate', () => {
  it('accepts real dates and rejects malformed / impossible ones', () => {
    expect(isValidISODate('2026-07-01')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true); // leap year
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2026-7-1')).toBe(false);
    expect(isValidISODate('not-a-date')).toBe(false);
  });

  it('round-trips through epoch days', () => {
    for (const d of ['1970-01-01', '2000-02-29', '2026-07-01', '1999-12-31']) {
      expect(fromEpochDay(toEpochDay(d))).toBe(d);
    }
    expect(toEpochDay('1970-01-01')).toBe(0);
  });

  it('throws on invalid input to toEpochDay', () => {
    expect(() => toEpochDay('2026-02-30')).toThrow(RangeError);
  });

  it('derives today from the injected clock (UTC)', () => {
    const clock = createFixedClock(Date.UTC(2026, 6, 1, 12, 0, 0));
    expect(todayISO(clock)).toBe('2026-07-01');
  });
});

describe('date math', () => {
  it('adds and diffs days across month/year boundaries', () => {
    expect(addDays('2026-07-01', 31)).toBe('2026-08-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(diffDays('2026-07-01', '2026-07-08')).toBe(7);
    expect(diffDays('2026-07-08', '2026-07-01')).toBe(-7);
  });

  it('computes weekday (Sunday = 0)', () => {
    expect(weekdayOf('2026-07-01')).toBe(3); // a Wednesday
    expect(weekdayOf('1970-01-01')).toBe(4); // a Thursday
  });

  it('finds week bounds for either week-start (locale-driven)', () => {
    // 2026-07-01 is a Wednesday.
    expect(startOfWeek('2026-07-01', 1)).toBe('2026-06-29'); // Monday start (CZ)
    expect(endOfWeek('2026-07-01', 1)).toBe('2026-07-05');
    expect(startOfWeek('2026-07-01', 0)).toBe('2026-06-28'); // Sunday start (US)
  });

  it('adds months with day clamping', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(endOfMonth('2024-02-15')).toBe('2024-02-29');
  });
});
