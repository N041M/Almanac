import type { MealsDaySlice } from '@almanac/meals';

/**
 * Every planned recipe id on a day (across all meal slots), in slot order.
 * Defensive: an absent or malformed slice contributes nothing, never throws (L5).
 */
export function dayRecipeIds(slice: MealsDaySlice | undefined): string[] {
  const slots = slice?.slots;
  if (typeof slots !== 'object' || slots === null) return [];
  return Object.values(slots)
    .map((cell) => cell?.recipeId ?? null)
    .filter((id): id is string => id !== null);
}

/** A single representative meal for compact surfaces (the month chip). */
export function representativeRecipeId(slice: MealsDaySlice | undefined): string | null {
  return dayRecipeIds(slice)[0] ?? null;
}
