import { describe, expect, it } from 'vitest';
import type { ISODate, Recurrence } from '@almanac/core';
import { nextShoppingDay, scheduledWindows, shoppingNowWindow } from './window.js';

// 2026-07-11 is a Saturday; a weekly rule from it fires every Saturday.
const everySaturday: Recurrence = { freq: 'weekly', start: '2026-07-11' };

describe('shoppingNowWindow — the ad-hoc trigger (§8.1)', () => {
  it('runs to the horizon when no shopping days are scheduled', () => {
    expect(shoppingNowWindow('2026-07-06' as ISODate, undefined, 7)).toEqual({
      start: '2026-07-06',
      end: '2026-07-12',
    });
  });

  it('runs until the day before the next scheduled shopping day', () => {
    expect(shoppingNowWindow('2026-07-06' as ISODate, everySaturday)).toEqual({
      start: '2026-07-06',
      end: '2026-07-10',
    });
  });

  it('looks strictly ahead — starting on a shopping day covers to the next one', () => {
    expect(shoppingNowWindow('2026-07-11' as ISODate, everySaturday)).toEqual({
      start: '2026-07-11',
      end: '2026-07-17',
    });
  });
});

describe('scheduledWindows — the recurring trigger (§8.1)', () => {
  it('opens one window per shopping day, each running to the day before the next', () => {
    const windows = scheduledWindows(everySaturday, '2026-07-06' as ISODate, '2026-07-20' as ISODate);
    expect(windows).toEqual([
      { start: '2026-07-11', end: '2026-07-17' },
      { start: '2026-07-18', end: '2026-07-24' },
    ]);
  });

  it('yields nothing when no shopping day falls in the range (empty is normal, L5)', () => {
    expect(scheduledWindows(everySaturday, '2026-07-06' as ISODate, '2026-07-09' as ISODate)).toEqual([]);
  });
});

describe('nextShoppingDay', () => {
  it('is undefined without a recurrence (falls back to horizon, L5)', () => {
    expect(nextShoppingDay(undefined, '2026-07-06' as ISODate)).toBeUndefined();
  });

  it('is undefined for a malformed rule (occurrencesInRange yields none, L5)', () => {
    const bad = { freq: 'weekly', start: 'not-a-date' } as Recurrence;
    expect(nextShoppingDay(bad, '2026-07-06' as ISODate)).toBeUndefined();
  });
});
