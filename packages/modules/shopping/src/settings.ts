import type { Frequency, Recurrence, Weekday } from '@almanac/core';
import { DEFAULT_HORIZON_DAYS } from './window.js';

/**
 * The shopping module's settings: the recurring shopping days (§8.1, first
 * trigger) and the fallback horizon for an unbounded "shopping now" window.
 * Absent recurrence ⇒ the module offers only the ad-hoc trigger — a normal,
 * fully-working lower-capability state (L5).
 */
export interface ShoppingSettings {
  recurrence?: Recurrence;
  horizonDays: number;
}

export const SHOPPING_SETTINGS_VERSION = 1;

export const DEFAULT_SHOPPING_SETTINGS: ShoppingSettings = {
  horizonDays: DEFAULT_HORIZON_DAYS,
};

const FREQUENCIES: readonly Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * A stored recurrence → a usable rule, or `undefined` when the shape is wrong.
 * Only the fields the shopping schedule uses are carried; a malformed rule is
 * simply dropped (occurrencesInRange then yields no shopping days — L5), it
 * never throws.
 */
export function decodeRecurrence(value: unknown): Recurrence | undefined {
  if (!isRecord(value)) return undefined;
  const freq = value['freq'];
  const start = value['start'];
  if (typeof start !== 'string') return undefined;
  if (typeof freq !== 'string' || !FREQUENCIES.includes(freq as Frequency)) return undefined;

  const rule: Recurrence = { freq: freq as Frequency, start };
  const byWeekday = value['byWeekday'];
  if (Array.isArray(byWeekday) && byWeekday.every((d) => typeof d === 'number')) {
    rule.byWeekday = byWeekday as Weekday[];
  }
  const interval = value['interval'];
  if (typeof interval === 'number' && Number.isFinite(interval) && interval >= 1) {
    rule.interval = Math.floor(interval);
  }
  return rule;
}

/** Decode stored settings, degrading each field independently to its default (L5). */
export function decodeShoppingSettings(value: unknown): ShoppingSettings {
  if (!isRecord(value)) return DEFAULT_SHOPPING_SETTINGS;
  const horizon = value['horizonDays'];
  const horizonDays =
    typeof horizon === 'number' && Number.isFinite(horizon) && horizon >= 1
      ? Math.floor(horizon)
      : DEFAULT_HORIZON_DAYS;
  const recurrence = decodeRecurrence(value['recurrence']);
  return recurrence !== undefined ? { recurrence, horizonDays } : { horizonDays };
}
