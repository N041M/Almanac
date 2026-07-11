import { create } from 'zustand';
import type { ISODate } from '@almanac/core';
import type { Ingredient, MacroSet, Recipe } from '@almanac/food';
import { mealsDayCodec } from '@almanac/meals';
import type { MacroField, MacroTargets, MacrosDaySlice } from '@almanac/macros';
import { catalog, quietly } from './meals-services';
import { dayStore } from './persistence';
import { macrosStore } from './macros-services';
import { dayRecipeIds } from './meals-day';
import { today } from '../clock';

const EMPTY_SLICE: MacrosDaySlice = { entries: [], plannedServings: 1 };

export interface MacrosState {
  loaded: boolean;
  loading: boolean;
  /** The day being viewed (defaults to today). */
  date: ISODate;
  targets: MacroTargets;
  slice: MacrosDaySlice;
  /** The meals planned on `date` (one per slot), read from the shared meals slice. */
  plannedRecipes: Recipe[];
  ingredients: Readonly<Record<string, Ingredient>>;

  load: () => Promise<void>;
  setDate: (date: ISODate) => Promise<void>;
  setTarget: (field: MacroField, value: number | null) => Promise<void>;
  setPlannedServings: (servings: number) => Promise<void>;
  addEntry: (label: string, macros: MacroSet) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
}

export const useMacros = create<MacrosState>((set, get) => {
  /** Read the day slice + the meal planned on a date. */
  async function readDay(
    date: ISODate,
    recipes: Readonly<Record<string, Recipe>>,
  ): Promise<{ slice: MacrosDaySlice; plannedRecipes: Recipe[] }> {
    const [slice, mealSlice] = await Promise.all([
      macrosStore.readDay(date),
      dayStore.readSlice(date, mealsDayCodec),
    ]);
    const plannedRecipes = dayRecipeIds(mealSlice)
      .map((id) => recipes[id])
      .filter((recipe): recipe is Recipe => recipe !== undefined);
    return { slice, plannedRecipes };
  }

  async function writeSlice(next: MacrosDaySlice): Promise<void> {
    set({ slice: next });
    await quietly(() => macrosStore.writeDay(get().date, next));
  }

  return {
    loaded: false,
    loading: false,
    date: today(),
    targets: {},
    slice: EMPTY_SLICE,
    plannedRecipes: [],
    ingredients: {},

    load: async () => {
      if (get().loaded || get().loading) return;
      set({ loading: true });
      try {
        const date = get().date;
        const [targets, recipeList, ingredientList] = await Promise.all([
          macrosStore.getTargets(),
          catalog.listRecipes(),
          catalog.listIngredients(),
        ]);
        const recipes: Record<string, Recipe> = {};
        for (const recipe of recipeList) recipes[recipe.id] = recipe;
        const ingredients: Record<string, Ingredient> = {};
        for (const ingredient of ingredientList) ingredients[ingredient.id] = ingredient;
        const { slice, plannedRecipes } = await readDay(date, recipes);
        set({ loaded: true, targets, ingredients, slice, plannedRecipes });
      } finally {
        set({ loading: false });
      }
    },

    setDate: async (date) => {
      // Rebuild the recipe map from current state to resolve the planned meal.
      const recipes: Record<string, Recipe> = {};
      set({ date });
      const list = await catalog.listRecipes();
      for (const recipe of list) recipes[recipe.id] = recipe;
      const { slice, plannedRecipes } = await readDay(date, recipes);
      if (get().date === date) set({ slice, plannedRecipes });
    },

    setTarget: async (field, value) => {
      const targets: MacroTargets = { ...get().targets };
      if (value === null || !Number.isFinite(value) || value < 0) delete targets[field];
      else targets[field] = value;
      set({ targets });
      await quietly(() => macrosStore.saveTargets(targets));
    },

    setPlannedServings: async (servings) => {
      if (!Number.isFinite(servings) || servings < 0) return;
      await writeSlice({ ...get().slice, plannedServings: servings });
    },

    addEntry: async (label, macros) => {
      const trimmed = label.trim();
      if (trimmed === '') return; // empty log: a quiet no-op (L5)
      const entry = { id: crypto.randomUUID(), label: trimmed, macros };
      await writeSlice({ ...get().slice, entries: [...get().slice.entries, entry] });
    },

    removeEntry: async (id) => {
      await writeSlice({
        ...get().slice,
        entries: get().slice.entries.filter((entry) => entry.id !== id),
      });
    },
  };
});
