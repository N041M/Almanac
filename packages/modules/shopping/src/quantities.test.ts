import { describe, expect, it } from 'vitest';
import type { Quantity } from '@almanac/core';
import { addQuantity } from './quantities.js';

describe('addQuantity — the units side of §8.1 aggregation', () => {
  it('merges compatible units into the first bucket, converting to its unit', () => {
    let buckets: Quantity[] = [{ value: 200, unit: 'g' }];
    buckets = addQuantity(buckets, { value: 0.3, unit: 'kg' });
    expect(buckets).toEqual([{ value: 500, unit: 'g' }]);
  });

  it('keeps incompatible dimensions separate ("2 onions" + "200 g onion")', () => {
    let buckets: Quantity[] = [{ value: 2, unit: 'piece' }];
    buckets = addQuantity(buckets, { value: 200, unit: 'g' });
    expect(buckets).toEqual([
      { value: 2, unit: 'piece' },
      { value: 200, unit: 'g' },
    ]);
  });

  it('keeps an unknown unit separate rather than dropping it (L5)', () => {
    let buckets: Quantity[] = [{ value: 1, unit: 'g' }];
    buckets = addQuantity(buckets, { value: 1, unit: 'glug' });
    expect(buckets).toHaveLength(2);
  });

  it('folds a run of mixed quantities into the minimum set of buckets', () => {
    let buckets: Quantity[] = [];
    for (const q of [
      { value: 1, unit: 'piece' },
      { value: 100, unit: 'g' },
      { value: 1, unit: 'piece' },
      { value: 50, unit: 'g' },
    ] satisfies Quantity[]) {
      buckets = addQuantity(buckets, q);
    }
    expect(buckets).toEqual([
      { value: 2, unit: 'piece' },
      { value: 150, unit: 'g' },
    ]);
  });
});
