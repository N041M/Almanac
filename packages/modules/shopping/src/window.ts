import { addDays, diffDays, occurrencesInRange, type ISODate, type Recurrence } from '@almanac/core';

/** An inclusive date range a single shopping trip covers meals for. */
export interface ShoppingWindow {
  start: ISODate;
  end: ISODate;
}

/** Fallback span for a window with no next shopping day to bound it. */
export const DEFAULT_HORIZON_DAYS = 7;

/** How far ahead to search for the next shopping day before giving up. */
const LOOKAHEAD_DAYS = 366;

/**
 * The first scheduled shopping day strictly after `after`. Uses core's single
 * recurrence primitive (§5) — nobody re-implements "every Saturday". No rule, a
 * malformed rule, or none within the lookahead ⇒ `undefined`, and the caller
 * falls back to the horizon (L5).
 */
export function nextShoppingDay(
  recurrence: Recurrence | undefined,
  after: ISODate,
): ISODate | undefined {
  if (recurrence === undefined) return undefined;
  const days = occurrencesInRange(recurrence, addDays(after, 1), addDays(after, LOOKAHEAD_DAYS));
  return days[0];
}

/**
 * The ad-hoc "shopping now" window (§8.1, second trigger): from `from` until the
 * day before the next scheduled shopping day, or `horizonDays` out when none is
 * scheduled. Computed on the spot — the windows fall out of the shopping days,
 * so the user never draws them by hand.
 */
export function shoppingNowWindow(
  from: ISODate,
  recurrence?: Recurrence,
  horizonDays: number = DEFAULT_HORIZON_DAYS,
): ShoppingWindow {
  const horizon = Math.max(1, horizonDays);
  const next = nextShoppingDay(recurrence, from);
  const end = next !== undefined ? addDays(next, -1) : addDays(from, horizon - 1);
  // The next day is strictly after `from`, so `end >= from`; guard anyway (L5).
  return { start: from, end: diffDays(from, end) < 0 ? from : end };
}

/**
 * Every scheduled trip window overlapping `[rangeStart, rangeEnd]` (§8.1, first
 * trigger): each shopping day opens a window that runs until the day before the
 * next shopping day, so choosing the days defines the windows automatically.
 */
export function scheduledWindows(
  recurrence: Recurrence,
  rangeStart: ISODate,
  rangeEnd: ISODate,
  horizonDays: number = DEFAULT_HORIZON_DAYS,
): ShoppingWindow[] {
  const horizon = Math.max(1, horizonDays);
  return occurrencesInRange(recurrence, rangeStart, rangeEnd).map((day) => {
    const next = nextShoppingDay(recurrence, day);
    const end = next !== undefined ? addDays(next, -1) : addDays(day, horizon - 1);
    return { start: day, end };
  });
}
