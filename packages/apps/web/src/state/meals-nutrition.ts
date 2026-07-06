import type { NutritionResult } from '@almanac/core';
import type { Ingredient } from '@almanac/food';
import type { MealsState } from './meals';
import { catalog, nutrition, quietly } from './meals-services';

type Set = (partial: Partial<MealsState> | ((s: MealsState) => Partial<MealsState>)) => void;
type Get = () => MealsState;

/**
 * The nutrition-guessing sub-feature (OFF lookup + match selection), split out
 * so the meals store stays planning logic. Shares the store's set/get; every
 * path degrades quietly — lookup is enrichment, never a gate (§7/L5).
 */
export function createNutritionActions(set: Set, get: Get) {
  async function guessNutrition(ingredientId: string): Promise<void> {
    const ingredient = get().ingredients[ingredientId];
    if (ingredient === undefined) return;
    let matches: NutritionResult[];
    try {
      // English-only for now; other locales will translate the name to
      // English here before searching (see food-name.ts).
      matches = (await nutrition.search(ingredient.name)).filter(
        (result) => result.per100g !== undefined,
      );
    } catch {
      return; // offline/error: quietly no choices, ingredient stays factless (L5)
    }
    if (get().ingredients[ingredientId] === undefined) return; // removed meanwhile
    // An empty result is stored too — the UI shows "no match" instead of
    // pretending nothing happened (quiet ≠ invisible). When facts already
    // exist (previous session), point the pick at the matching choice so the
    // selector reflects what's actually applied.
    const applied = get().ingredients[ingredientId]?.nutrition?.per100g;
    const appliedIndex =
      applied === undefined
        ? undefined
        : matches.findIndex((m) => JSON.stringify(m.per100g) === JSON.stringify(applied));
    set((s) => ({
      nutritionChoices: { ...s.nutritionChoices, [ingredientId]: matches },
      ...(appliedIndex !== undefined && appliedIndex >= 0
        ? { nutritionPick: { ...s.nutritionPick, [ingredientId]: appliedIndex } }
        : {}),
    }));
    // Auto-apply the top match only when the ingredient has no facts yet —
    // a user-confirmed pick is never overwritten by a background guess.
    if (matches.length > 0 && applied === undefined) {
      await applyNutrition(ingredientId, 0);
    }
  }

  async function guessAllNutrition(recipeId: string): Promise<void> {
    const recipe = get().recipes[recipeId];
    if (recipe === undefined) return;
    const factless = [...new Set(recipe.ingredients.map((line) => line.ingredientId))].filter(
      (id) => get().ingredients[id] !== undefined && get().ingredients[id]?.nutrition === undefined,
    );
    // Sequential on purpose: OFF rate-limits; a personal recipe is a handful.
    for (const id of factless) await guessNutrition(id);
  }

  async function applyNutrition(ingredientId: string, choice: number | null): Promise<void> {
    const { ingredients, nutritionChoices } = get();
    const ingredient = ingredients[ingredientId];
    if (ingredient === undefined) return;
    const picked = choice === null ? undefined : nutritionChoices[ingredientId]?.[choice];
    if (choice !== null && picked?.per100g === undefined) return;

    const bare: Ingredient = { ...ingredient };
    delete bare.nutrition;
    const next: Ingredient =
      picked?.per100g === undefined ? bare : { ...bare, nutrition: { per100g: picked.per100g } };
    set((s) => ({
      ingredients: { ...s.ingredients, [ingredientId]: next },
      nutritionPick: { ...s.nutritionPick, [ingredientId]: choice },
    }));
    await quietly(() => catalog.saveIngredient(next));
  }

  return { guessNutrition, guessAllNutrition, applyNutrition };
}
