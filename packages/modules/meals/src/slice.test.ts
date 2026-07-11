import { describe, expect, it } from 'vitest';
import { createDayStore, createMemoryStorage } from '@almanac/core';
import { mealsDayCodec } from './slice.js';
import type { MealsDaySlice } from './slice.js';

const DATE = '2026-07-06';

describe('mealsDayCodec (per meal slot)', () => {
  it('round-trips a day of several meals through the day-store', async () => {
    const store = createDayStore(createMemoryStorage());
    const slice: MealsDaySlice = {
      slots: {
        breakfast: { recipeId: 'oats', locked: false, breakdown: null },
        dinner: {
          recipeId: 'goulash',
          locked: true,
          breakdown: {
            prob: 0.4,
            candidateCount: 5,
            fFreq: 2,
            fRec: 0.8,
            fTag: 1,
            daysSince: 9,
            alternatives: [{ id: 'soup', name: 'Soup', p: 0.3 }],
          },
        },
      },
    };
    await store.writeSlice(DATE, mealsDayCodec, slice);
    expect(await store.readSlice(DATE, mealsDayCodec)).toEqual(slice);
  });

  it('absent day ⇒ the default empty slice — a normal state (L5)', async () => {
    const store = createDayStore(createMemoryStorage());
    expect(await store.readSlice(DATE, mealsDayCodec)).toEqual({ slots: {} });
  });

  it('a legacy single-meal slice decodes into the dinner slot (back-compat)', () => {
    const decoded = mealsDayCodec.decode({ recipeId: 'goulash', locked: true, breakdown: null });
    expect(decoded).toEqual({
      slots: { dinner: { recipeId: 'goulash', locked: true, breakdown: null } },
    });
  });

  it('a corrupt payload degrades to the default via the store (slice isolation)', async () => {
    const storage = createMemoryStorage({
      [`day:${DATE}:meals`]: JSON.stringify({ v: 1, d: { recipeId: 42 } }),
    });
    const store = createDayStore(storage);
    expect(await store.readSlice(DATE, mealsDayCodec)).toEqual(mealsDayCodec.default());
  });

  it('one malformed slot is dropped; the rest of the day stands (L5)', () => {
    const decoded = mealsDayCodec.decode({
      slots: {
        dinner: { recipeId: 'goulash', locked: 'yes', breakdown: { prob: 'high' } },
        lunch: 42,
      },
    });
    expect(decoded).toEqual({
      slots: { dinner: { recipeId: 'goulash', locked: false, breakdown: null } },
    });
  });
});
