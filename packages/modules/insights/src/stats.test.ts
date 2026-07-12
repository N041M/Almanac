import { describe, expect, it } from 'vitest';
import { allocateMinutes, averageByGroup, correlate } from './stats.js';

describe('correlate — descriptive, gated (L5: no claim beats a shaky one)', () => {
  it('finds a clean positive relationship', () => {
    const pairs = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 2 * i + 1 }));
    const c = correlate(pairs);
    expect(c?.r).toBeCloseTo(1);
    expect(c?.strength).toBe('strong');
    expect(c?.n).toBe(10);
  });

  it('reports opposite movement with a negative r', () => {
    const pairs = Array.from({ length: 12 }, (_, i) => ({ x: i, y: 20 - i + (i % 2) * 2 }));
    const c = correlate(pairs);
    expect(c).not.toBeNull();
    expect(c?.r ?? 0).toBeLessThan(0);
  });

  it('refuses thin samples, constants, and negligible relationships', () => {
    expect(correlate([{ x: 1, y: 2 }])).toBeNull();
    expect(
      correlate(Array.from({ length: 10 }, (_, i) => ({ x: 3, y: i }))),
    ).toBeNull(); // zero variance
    // Symmetric across both x groups ⇒ r = 0 ⇒ below the reportable floor.
    const noise = Array.from({ length: 20 }, (_, i) => ({
      x: i % 2,
      y: [3, 3, 5, 5][i % 4] ?? 0,
    }));
    expect(correlate(noise)).toBeNull();
  });
});

describe('averageByGroup', () => {
  it('averages per group, drops anecdotes, sorts by mean', () => {
    const entries = [
      ...Array.from({ length: 4 }, () => ({ group: 'luteal', value: 2 })),
      ...Array.from({ length: 3 }, () => ({ group: 'follicular', value: 4 })),
      { group: 'ovulation', value: 5 }, // n=1: an anecdote, dropped
    ];
    expect(averageByGroup(entries)).toEqual([
      { group: 'follicular', mean: 4, n: 3 },
      { group: 'luteal', mean: 2, n: 4 },
    ]);
  });

  it('empty in ⇒ empty out', () => {
    expect(averageByGroup([])).toEqual([]);
  });
});

describe('allocateMinutes', () => {
  it('totals per key, descending; junk spans contribute nothing (L5)', () => {
    expect(
      allocateMinutes([
        { key: 'work', minutes: 60 },
        { key: 'personal', minutes: 45 },
        { key: 'work', minutes: 30 },
        { key: 'broken', minutes: -5 },
        { key: 'broken', minutes: Number.NaN },
      ]),
    ).toEqual([
      { key: 'work', minutes: 90 },
      { key: 'personal', minutes: 45 },
    ]);
  });
});
