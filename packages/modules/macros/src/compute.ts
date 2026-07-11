import { deriveRecipeNutrition, type Ingredient, type Recipe } from '@almanac/food';
import type { DayMacros, MacroEntry, MacroTargets } from './types.js';
import { remainingMacros, scaleMacros, sumMacros } from './macro-math.js';

export interface DayMacrosInput {
  /**
   * The recipes planned for the day (one per meal slot), read from the shared
   * meals slice. Empty ⇒ nothing auto-filled.
   */
  plannedRecipes: ReadonlyArray<Recipe>;
  ingredientsById: ReadonlyMap<string, Ingredient>;
  /** Manual intake entries logged for the day. */
  entries: readonly MacroEntry[];
  /** Servings of the planned meals counted as eaten (default 1; 0 excludes them). */
  plannedServings?: number;
  targets: MacroTargets;
}

/**
 * A day's macro picture from the plan + manual logs (§8). Each planned meal
 * auto-fills one serving from its recipe via the food kernel, summed across the
 * day's slots — never copied into storage. Pure and deterministic (L3/L4);
 * every partial input degrades quietly (L5).
 */
export function computeDayMacros(input: DayMacrosInput): DayMacros {
  const servings = input.plannedServings ?? 1;
  // Non-positive servings exclude the planned meals entirely — sparse, not a
  // set of zeroed fields (L5: absent beats a hard 0).
  const fromPlan =
    servings > 0
      ? scaleMacros(
          sumMacros(
            input.plannedRecipes.map(
              (recipe) => deriveRecipeNutrition(recipe, input.ingredientsById).perServing,
            ),
          ),
          servings,
        )
      : {};
  const fromManual = sumMacros(input.entries.map((entry) => entry.macros));
  const intake = sumMacros([fromPlan, fromManual]);
  return { intake, fromPlan, fromManual, remaining: remainingMacros(input.targets, intake) };
}
