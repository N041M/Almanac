import type { ISODate } from '../time/iso-date.js';

/**
 * The composite the whole app orbits (design §5): one record per date holding
 * each module's contribution under its own namespace (`meals`, `tasks`, …).
 * Sparse by nature — **every reader treats an absent slice as a normal, handled
 * state, never an error** (L5). The calendar is just a lens over Days.
 */
export interface Day {
  date: ISODate;
  slices: Readonly<Record<string, unknown>>;
}

export function emptyDay(date: ISODate): Day {
  return { date, slices: {} };
}

/** A module's slice, or `undefined` if it hasn't written one (absent = normal, L5). */
export function getSlice<T>(day: Day, namespace: string): T | undefined {
  return day.slices[namespace] as T | undefined;
}

/** Immutably set one namespace's slice; other slices are untouched (isolation). */
export function withSlice<T>(day: Day, namespace: string, value: T): Day {
  return { date: day.date, slices: { ...day.slices, [namespace]: value } };
}
