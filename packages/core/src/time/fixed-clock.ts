import type { Clock } from '../ports/clock.js';

/**
 * A deterministic clock frozen at a fixed instant — the L4 seam for tests and
 * reproducible logic. No `Date.now()`, so it's safe in the pure core.
 */
export function createFixedClock(nowMs: number): Clock {
  return { now: () => nowMs };
}
