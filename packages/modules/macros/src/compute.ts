import { deriveRecipeNutrition, type Ingredient, type Recipe } from '@almanac/food';
import type { DayMacros, MacroEntry, MacroTargets } from './types.js';
import { remainingMacros, scaleMacros, sumMacros } from './macro-math.js';

export interface DayMacrosInput {
  /** The recipe planned for the day (read from the shared meals slice), or null. */
  plannedRecipe: Recipe | null;
  ingredientsById: ReadonlyMap<string, Ingredient>;
  /** Manual intake entries logged for the day. */
  entries: readonly MacroEntry[];
  /** Servings of the planned meal counted as eaten (default 1; 0 excludes it). */
  plannedServings?: number;
  targets: MacroTargets;
}

/**
 * A day's macro picture from the plan + manual logs (§8). The planned meal
 * auto-fills from its recipe via the food kernel (one serving by default),
 * never copied into storage. Pure and deterministic (L3/L4); every partial
 * input degrades quietly — no recipe, no ingredient facts, or sparse macros all
 * simply contribute less, never throw (L5).
 */
export function computeDayMacros(input: DayMacrosInput): DayMacros {
  const servings = input.plannedServings ?? 1;
  // Non-positive servings exclude the planned meal entirely — sparse, not a
  // set of zeroed fields (L5: absent beats a hard 0).
  const fromPlan =
    input.plannedRecipe === null || !(servings > 0)
      ? {}
      : scaleMacros(
          deriveRecipeNutrition(input.plannedRecipe, input.ingredientsById).perServing,
          servings,
        );
  const fromManual = sumMacros(input.entries.map((entry) => entry.macros));
  const intake = sumMacros([fromPlan, fromManual]);
  return { intake, fromPlan, fromManual, remaining: remainingMacros(input.targets, intake) };
}
