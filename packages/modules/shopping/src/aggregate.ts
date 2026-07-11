import { getSlice, type Day, type Quantity } from '@almanac/core';
import type { Ingredient, Recipe } from '@almanac/food';
import type { ShoppingWindow } from './window.js';
import { addQuantity } from './quantities.js';
import { OTHER_AISLE, type ShoppingGroup, type ShoppingLine, type ShoppingList } from './types.js';

/** The kernel lookups the aggregation resolves ids against. */
export interface ShoppingLookups {
  recipesById: ReadonlyMap<string, Recipe>;
  ingredientsById: ReadonlyMap<string, Ingredient>;
}

/**
 * The meals module writes its planned recipe under this Day namespace (§5).
 * Shopping reads that shared field **without importing the meals module** — the
 * field name is the contract, not the package (L1's shared-data seam). It
 * narrows defensively: any non-string shape degrades to "no meal planned" (L5).
 */
const MEALS_NAMESPACE = 'meals';

/**
 * Every recipe planned on a day, across all meal slots. Reads the shared slice
 * shape `{ slots: { [id]: { recipeId } } }` defensively (any deviation yields
 * fewer ids, never a throw — L5). A legacy `{ recipeId }` slice is still read.
 */
function plannedRecipeIds(day: Day): string[] {
  const slice = getSlice<unknown>(day, MEALS_NAMESPACE);
  if (typeof slice !== 'object' || slice === null) return [];
  const record = slice as Record<string, unknown>;

  const slots = record['slots'];
  if (typeof slots === 'object' && slots !== null) {
    const ids: string[] = [];
    for (const cell of Object.values(slots as Record<string, unknown>)) {
      if (typeof cell !== 'object' || cell === null) continue;
      const id = (cell as Record<string, unknown>)['recipeId'];
      if (typeof id === 'string') ids.push(id);
    }
    return ids;
  }
  // Legacy single-meal shape.
  const id = record['recipeId'];
  return typeof id === 'string' ? [id] : [];
}

interface Accumulator {
  name: string;
  tags: string[];
  quantities: Quantity[];
  flagged: boolean;
}

/** OTHER_AISLE sorts last; named aisles sort alphabetically among themselves. */
function aisleRank(aisle: string): number {
  return aisle === OTHER_AISLE ? 1 : 0;
}

/**
 * The one aggregation engine behind both triggers (§8.1): gather the meals
 * planned across `days`, expand each into its recipe's ingredients, aggregate by
 * ingredient with unit normalization (compatible units merge, incompatible ones
 * stay separate), and group by aisle tag. Pure and deterministic (L3/L4) — the
 * caller fetches the Day range from the store and passes it in.
 *
 * Degradation ladder (L5, never throws): a planned recipe missing from the
 * lookup is skipped and counted; an off-catalog ingredient is listed under its
 * id and flagged; a non-finite quantity flags its line but never drops it.
 */
export function aggregateWindow(
  window: ShoppingWindow,
  days: readonly Day[],
  lookups: ShoppingLookups,
): ShoppingList {
  const acc = new Map<string, Accumulator>();
  const missingRecipes: string[] = [];
  const seenMissing = new Set<string>();

  for (const day of days) {
    for (const recipeId of plannedRecipeIds(day)) {
      const recipe = lookups.recipesById.get(recipeId);
      if (recipe === undefined) {
        if (!seenMissing.has(recipeId)) {
          seenMissing.add(recipeId);
          missingRecipes.push(recipeId);
        }
        continue;
      }
      for (const { ingredientId, quantity } of recipe.ingredients) {
      const ingredient = lookups.ingredientsById.get(ingredientId);
      let entry = acc.get(ingredientId);
      if (entry === undefined) {
        entry = {
          name: ingredient?.name ?? ingredientId,
          tags: ingredient?.tags ?? [],
          quantities: [],
          flagged: ingredient === undefined,
        };
        acc.set(ingredientId, entry);
      }
      if (Number.isFinite(quantity.value)) {
        entry.quantities = addQuantity(entry.quantities, quantity);
      } else {
        entry.flagged = true;
      }
      }
    }
  }

  const byAisle = new Map<string, ShoppingLine[]>();
  for (const [ingredientId, entry] of acc) {
    const aisle = entry.tags[0] ?? OTHER_AISLE;
    const line: ShoppingLine = {
      ingredientId,
      name: entry.name,
      quantities: entry.quantities,
      flagged: entry.flagged,
    };
    const lines = byAisle.get(aisle) ?? [];
    lines.push(line);
    byAisle.set(aisle, lines);
  }

  const groups: ShoppingGroup[] = [...byAisle.entries()]
    .sort(([a], [b]) => aisleRank(a) - aisleRank(b) || a.localeCompare(b))
    .map(([aisle, lines]) => ({
      aisle,
      lines: [...lines].sort(
        (x, y) => x.name.localeCompare(y.name) || x.ingredientId.localeCompare(y.ingredientId),
      ),
    }));

  return { start: window.start, end: window.end, groups, missingRecipes };
}
