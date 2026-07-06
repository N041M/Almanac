import type { ISODate, Quantity } from '@almanac/core';

/**
 * One aggregated ingredient in a shopping list. Quantities are pre-combined:
 * compatible units merge into one entry, incompatible ones stay separate
 * (the units side of the §8.1 aggregation) — e.g. `[{value: 400, unit: 'g'}]`
 * or `[{value: 2, unit: 'piece'}, {value: 200, unit: 'g'}]`.
 */
export interface ShoppingLine {
  ingredientId: string;
  /** Display name; falls back to the id when the ingredient is off-catalog (L5). */
  name: string;
  quantities: Quantity[];
  /**
   * True when at least one contribution couldn't be fully accounted for — an
   * off-catalog ingredient or a non-finite quantity. The line is still listed,
   * just flagged; missing data reduces function, never drops the item (§9/L5).
   */
  flagged: boolean;
}

/** Lines grouped by aisle/category tag. Untagged ingredients fall under `OTHER_AISLE`. */
export interface ShoppingGroup {
  aisle: string;
  lines: ShoppingLine[];
}

/**
 * A generated shopping list for one window — the output of `aggregateWindow`,
 * shared by both triggers (scheduled trip / "shopping now", §8.1). Pure derived
 * data: it is recomputed from the plan, never the durable store.
 */
export interface ShoppingList {
  /** Inclusive first day of the window. */
  start: ISODate;
  /** Inclusive last day the window covers meals for. */
  end: ISODate;
  groups: ShoppingGroup[];
  /**
   * Recipe ids planned in the window but absent from the recipe lookup — skipped
   * and counted, never a thrown error (L5). Surfaced so the UI can say
   * "2 planned meals couldn't be listed".
   */
  missingRecipes: string[];
}

/** Aisle bucket for ingredients with no category tag (§7: empty tags is normal). */
export const OTHER_AISLE = 'other';
