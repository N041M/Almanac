import { describe, expect, it } from 'vitest';
import type { Ingredient, Recipe } from '@almanac/food';
import { computeDayMacros } from './compute.js';
import { sumMacros, scaleMacros, remainingMacros } from './macro-math.js';

const ingredients = new Map<string, Ingredient>([
  ['chicken', { id: 'chicken', name: 'Chicken', tags: [], nutrition: { per100g: { kcal: 165, proteinG: 31 } } }],
  ['rice', { id: 'rice', name: 'Rice', tags: [], nutrition: { per100g: { kcal: 130, carbsG: 28 } } }],
]);

// 200 g chicken + 200 g rice, 2 servings ⇒ perServing = { kcal: 295, proteinG: 31, carbsG: 28 }.
const bowl: Recipe = {
  id: 'bowl',
  name: 'Chicken & rice',
  tags: [],
  servings: 2,
  ingredients: [
    { ingredientId: 'chicken', quantity: { value: 200, unit: 'g' } },
    { ingredientId: 'rice', quantity: { value: 200, unit: 'g' } },
  ],
};

describe('macro-math', () => {
  it('sums sparse sets field by field, keeping absent fields absent (L5)', () => {
    expect(sumMacros([{ kcal: 100, proteinG: 10 }, { kcal: 50, fatG: 5 }])).toEqual({
      kcal: 150,
      proteinG: 10,
      fatG: 5,
    });
  });

  it('ignores non-finite values instead of poisoning the total', () => {
    expect(sumMacros([{ kcal: 100 }, { kcal: Number.NaN }])).toEqual({ kcal: 100 });
  });

  it('scales only present fields', () => {
    expect(scaleMacros({ kcal: 100, proteinG: 10 }, 1.5)).toEqual({ kcal: 150, proteinG: 15 });
  });

  it('computes remaining only where a target exists; negative = over', () => {
    expect(remainingMacros({ kcal: 2000, proteinG: 150 }, { kcal: 2100, proteinG: 80 })).toEqual({
      kcal: -100,
      proteinG: 70,
    });
  });
});

describe('computeDayMacros (§8)', () => {
  it('auto-fills one serving of the planned meal plus manual entries', () => {
    const result = computeDayMacros({
      plannedRecipe: bowl,
      ingredientsById: ingredients,
      entries: [{ id: 'a', label: 'Apple', macros: { kcal: 95, carbsG: 25 } }],
      targets: { kcal: 2000, proteinG: 150 },
    });
    expect(result.fromPlan).toEqual({ kcal: 295, proteinG: 31, carbsG: 28 });
    expect(result.fromManual).toEqual({ kcal: 95, carbsG: 25 });
    expect(result.intake).toEqual({ kcal: 390, proteinG: 31, carbsG: 53 });
    // Remaining only where a target is set.
    expect(result.remaining).toEqual({ kcal: 1610, proteinG: 119 });
  });

  it('scales the planned meal by servings eaten (0 excludes it)', () => {
    const zero = computeDayMacros({
      plannedRecipe: bowl,
      ingredientsById: ingredients,
      entries: [],
      plannedServings: 0,
      targets: {},
    });
    expect(zero.fromPlan).toEqual({});
    expect(zero.intake).toEqual({});
  });

  it('degrades to just manual entries when no meal is planned (L5)', () => {
    const result = computeDayMacros({
      plannedRecipe: null,
      ingredientsById: ingredients,
      entries: [{ id: 'a', label: 'Shake', macros: { kcal: 200, proteinG: 30 } }],
      targets: { proteinG: 150 },
    });
    expect(result.fromPlan).toEqual({});
    expect(result.intake).toEqual({ kcal: 200, proteinG: 30 });
    expect(result.remaining).toEqual({ proteinG: 120 });
  });

  it('reduces function without throwing when ingredient facts are missing (L5)', () => {
    const result = computeDayMacros({
      plannedRecipe: bowl,
      ingredientsById: new Map(),
      entries: [],
      targets: {},
    });
    expect(result.intake).toEqual({});
  });
});
