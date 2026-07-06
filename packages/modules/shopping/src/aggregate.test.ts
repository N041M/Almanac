import { describe, expect, it } from 'vitest';
import { emptyDay, withSlice, type Day, type ISODate } from '@almanac/core';
import type { Ingredient, Recipe } from '@almanac/food';
import { aggregateWindow, type ShoppingLookups } from './aggregate.js';
import { OTHER_AISLE } from './types.js';

function ingredient(id: string, name: string, tags: string[]): Ingredient {
  return { id, name, tags };
}

function recipe(id: string, ingredients: Recipe['ingredients']): Recipe {
  return { id, name: id, tags: [], ingredients, servings: 2 };
}

/** A day carrying a planned meal, via the shared `meals` slice (not an import). */
function planned(date: ISODate, recipeId: string | null): Day {
  return withSlice(emptyDay(date), 'meals', { recipeId, locked: false, breakdown: null });
}

const window = { start: '2026-07-06' as ISODate, end: '2026-07-08' as ISODate };

const lookups: ShoppingLookups = {
  recipesById: new Map<string, Recipe>([
    ['stew', recipe('stew', [
      { ingredientId: 'onion', quantity: { value: 2, unit: 'piece' } },
      { ingredientId: 'beef', quantity: { value: 400, unit: 'g' } },
    ])],
    ['soup', recipe('soup', [
      { ingredientId: 'onion', quantity: { value: 0.2, unit: 'kg' } },
      { ingredientId: 'stock', quantity: { value: 500, unit: 'ml' } },
    ])],
  ]),
  ingredientsById: new Map<string, Ingredient>([
    ['onion', ingredient('onion', 'Onion', ['produce'])],
    ['beef', ingredient('beef', 'Beef', ['meat'])],
    ['stock', ingredient('stock', 'Stock', ['pantry'])],
  ]),
};

describe('aggregateWindow — the one engine, §8.1', () => {
  it('aggregates planned meals by ingredient and groups by aisle', () => {
    const list = aggregateWindow(window, [planned('2026-07-06', 'stew'), planned('2026-07-07', 'soup')], lookups);

    // Onion appears in both recipes with different units: pieces stay separate
    // from the mass contribution — compatible masses would merge (L5/§8.1).
    const produce = list.groups.find((g) => g.aisle === 'produce');
    const onion = produce?.lines.find((l) => l.ingredientId === 'onion');
    expect(onion?.quantities).toEqual([
      { value: 2, unit: 'piece' },
      { value: 200, unit: 'g' },
    ]);

    // Aisles present, none flagged, no missing recipes.
    expect(list.groups.map((g) => g.aisle)).toEqual(['meat', 'pantry', 'produce']);
    expect(list.missingRecipes).toEqual([]);
    expect(list.start).toBe(window.start);
    expect(list.end).toBe(window.end);
  });

  it('merges the same ingredient across days when units are compatible', () => {
    const list = aggregateWindow(window, [planned('2026-07-06', 'soup'), planned('2026-07-07', 'soup')], lookups);
    const onion = list.groups.flatMap((g) => g.lines).find((l) => l.ingredientId === 'onion');
    expect(onion?.quantities).toEqual([{ value: 400, unit: 'g' }]);
  });

  it('skips and counts a planned recipe missing from the lookup (never throws, L5)', () => {
    const list = aggregateWindow(window, [planned('2026-07-06', 'ghost'), planned('2026-07-07', 'stew')], lookups);
    expect(list.missingRecipes).toEqual(['ghost']);
    // The real recipe still produced its lines.
    expect(list.groups.flatMap((g) => g.lines).map((l) => l.ingredientId)).toContain('beef');
  });

  it('lists an off-catalog ingredient under its id and flags it', () => {
    const withUnknown = { ...lookups, ingredientsById: new Map<string, Ingredient>() };
    const list = aggregateWindow(window, [planned('2026-07-06', 'stew')], withUnknown);
    const onion = list.groups.flatMap((g) => g.lines).find((l) => l.ingredientId === 'onion');
    expect(onion?.name).toBe('onion');
    expect(onion?.flagged).toBe(true);
    // Untagged ⇒ the OTHER aisle, sorted last.
    expect(list.groups.at(-1)?.aisle).toBe(OTHER_AISLE);
  });

  it('flags but never drops a line with a non-finite quantity', () => {
    const badRecipe: Recipe = recipe('bad', [
      { ingredientId: 'beef', quantity: { value: Number.NaN, unit: 'g' } },
    ]);
    const bad = { ...lookups, recipesById: new Map([['bad', badRecipe]]) };
    const list = aggregateWindow(window, [planned('2026-07-06', 'bad')], bad);
    const beef = list.groups.flatMap((g) => g.lines).find((l) => l.ingredientId === 'beef');
    expect(beef).toBeDefined();
    expect(beef?.flagged).toBe(true);
    expect(beef?.quantities).toEqual([]);
  });

  it('ignores days with no planned meal or a corrupt meals slice (absent = normal, L5)', () => {
    const corrupt = withSlice(emptyDay('2026-07-08'), 'meals', 42);
    const list = aggregateWindow(
      window,
      [planned('2026-07-06', null), emptyDay('2026-07-07'), corrupt],
      lookups,
    );
    expect(list.groups).toEqual([]);
    expect(list.missingRecipes).toEqual([]);
  });
});
