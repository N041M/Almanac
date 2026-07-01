import type { Clock } from '../ports/clock.js';

/** A calendar date "YYYY-MM-DD". Timezone-free by design; math is UTC-based. */
export type ISODate = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** True if `value` is a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isValidISODate(value: string): value is ISODate {
  const m = ISO_RE.exec(value);
  if (m === null) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  // Round-trip: if any component was out of range, the constructed date differs.
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/** Parse to epoch-day count (days since 1970-01-01). Throws on an invalid date. */
export function toEpochDay(date: ISODate): number {
  const m = ISO_RE.exec(date);
  if (m === null || !isValidISODate(date)) {
    throw new RangeError(`Invalid ISODate: ${date}`);
  }
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.floor(ms / MS_PER_DAY);
}

/** Inverse of `toEpochDay`. */
export function fromEpochDay(epochDay: number): ISODate {
  const d = new Date(epochDay * MS_PER_DAY);
  const year = d.getUTCFullYear().toString().padStart(4, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Today's date from the injected clock (L4), in UTC. A locale/timezone offset
 * can be layered on later; the core stays deterministic.
 */
export function todayISO(clock: Clock): ISODate {
  return fromEpochDay(Math.floor(clock.now() / MS_PER_DAY));
}
