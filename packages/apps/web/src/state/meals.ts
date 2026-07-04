import { create } from 'zustand';
import { createSeededRng, startOfWeek, type ISODate } from '@almanac/core';
import { createFoodCatalog, type Ingredient, type Recipe } from '@almanac/food';
import {
  WEIGHT_PRESETS,
  commitWeek,
  createMealsStore,
  generateWeek,
  rerollDay,
  type PlanItem,
  type Settings,
  type WeekPlan,
} from '@almanac/meals';
import { dayStore, storagePort } from './persistence';
import { systemClock, today } from '../clock';

// Composition root for the meals module (L4 edges live here): the real clock
// seeds the Rng, and the engine itself stays pure and deterministic.
const catalog = createFoodCatalog(storagePort, systemClock);
const mealsStore = createMealsStore(storagePort, dayStore, systemClock);
const rng = createSeededRng(systemClock.now() >>> 0);

export type WeightPreset = keyof typeof WEIGHT_PRESETS;

/** The preset whose weight matches, for showing stored weights as presets. */
export function presetOf(weight: number): WeightPreset {
  const hit = (Object.keys(WEIGHT_PRESETS) as WeightPreset[]).find(
    (key) => WEIGHT_PRESETS[key] === weight,
  );
  return hit ?? 'normal';
}

interface MealsState {
  loaded: boolean;
  recipes: Readonly<Record<string, Recipe>>;
  ingredients: Readonly<Record<string, Ingredient>>;
  items: PlanItem[];
  settings: Settings | null;
  plan: WeekPlan;
  /** Index of the plan entry whose breakdown panel is open. */
  breakdownIndex: number | null;

  load: () => Promise<void>;
  addMeal: (name: string, tags: string, preset: WeightPreset) => Promise<void>;
  removeMeal: (recipeId: string) => Promise<void>;
  updateItem: (recipeId: string, patch: Partial<PlanItem>) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  /** Add one ingredient line; reuses a catalog ingredient by name or creates it. */
  addIngredient: (recipeId: string, name: string, amount: number, unit: string) => Promise<void>;
  removeIngredient: (recipeId: string, line: number) => Promise<void>;
  setServings: (recipeId: string, servings: number) => Promise<void>;
  generate: () => Promise<void>;
  reroll: (index: number) => Promise<void>;
  toggleLock: (index: number) => Promise<void>;
  commit: () => Promise<void>;
  showBreakdown: (index: number | null) => void;
}

/** This Monday (weekStart is locale-driven later; the engine only needs a date). */
function currentWeekStart(): ISODate {
  return startOfWeek(today(), 1);
}

/** Persist quietly: a failed write degrades to session-only state (L5). */
async function quietly(write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch {
    // In-memory state already reflects the action.
  }
}

export const useMeals = create<MealsState>((set, get) => ({
  loaded: false,
  recipes: {},
  ingredients: {},
  items: [],
  settings: null,
  plan: [],
  breakdownIndex: null,

  load: async () => {
    if (get().loaded) return;
    const settings = await mealsStore.getSettings(currentWeekStart());
    const [recipeList, ingredientList, items, plan] = await Promise.all([
      catalog.listRecipes(),
      catalog.listIngredients(),
      mealsStore.getItems(),
      mealsStore.readWeek(settings.weekStart),
    ]);
    const recipes: Record<string, Recipe> = {};
    for (const recipe of recipeList) recipes[recipe.id] = recipe;
    const ingredients: Record<string, Ingredient> = {};
    for (const ingredient of ingredientList) ingredients[ingredient.id] = ingredient;
    set({ loaded: true, recipes, ingredients, items, settings, plan });
  },

  addMeal: async (name, tags, preset) => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    const recipe: Recipe = {
      id: crypto.randomUUID(),
      name: trimmed,
      tags: tags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag !== ''),
      ingredients: [],
      servings: 2,
    };
    const item: PlanItem = {
      recipeId: recipe.id,
      weight: WEIGHT_PRESETS[preset],
      cooldownDays: null,
      enabled: true,
      lastServed: null,
    };
    const items = [...get().items, item];
    set((s) => ({ recipes: { ...s.recipes, [recipe.id]: recipe }, items }));
    await quietly(() => catalog.saveRecipe(recipe));
    await quietly(() => mealsStore.saveItems(items));
  },

  removeMeal: async (recipeId) => {
    const items = get().items.filter((item) => item.recipeId !== recipeId);
    set((s) => {
      const recipes = { ...s.recipes };
      delete recipes[recipeId];
      return { recipes, items };
    });
    await quietly(() => catalog.removeRecipe(recipeId));
    await quietly(() => mealsStore.saveItems(items));
  },

  updateItem: async (recipeId, patch) => {
    const items = get().items.map((item) =>
      item.recipeId === recipeId ? { ...item, ...patch } : item,
    );
    set({ items });
    await quietly(() => mealsStore.saveItems(items));
  },

  addIngredient: async (recipeId, name, amount, unit) => {
    const recipe = get().recipes[recipeId];
    const trimmed = name.trim();
    if (recipe === undefined || trimmed === '' || !Number.isFinite(amount) || amount <= 0) return;

    // Reuse the catalog entry with this name (one "Onion" app-wide — shopping
    // aggregates by ingredient id, §8.1); create it only when new.
    const existing = Object.values(get().ingredients).find(
      (candidate) => candidate.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const ingredient: Ingredient =
      existing ?? { id: crypto.randomUUID(), name: trimmed, tags: [], defaultUnit: unit };

    const nextRecipe: Recipe = {
      ...recipe,
      ingredients: [
        ...recipe.ingredients,
        { ingredientId: ingredient.id, quantity: { value: amount, unit } },
      ],
    };
    set((s) => ({
      recipes: { ...s.recipes, [recipeId]: nextRecipe },
      ingredients: existing !== undefined ? s.ingredients : { ...s.ingredients, [ingredient.id]: ingredient },
    }));
    if (existing === undefined) await quietly(() => catalog.saveIngredient(ingredient));
    await quietly(() => catalog.saveRecipe(nextRecipe));
  },

  removeIngredient: async (recipeId, line) => {
    const recipe = get().recipes[recipeId];
    if (recipe === undefined) return;
    const nextRecipe: Recipe = {
      ...recipe,
      ingredients: recipe.ingredients.filter((_, i) => i !== line),
    };
    set((s) => ({ recipes: { ...s.recipes, [recipeId]: nextRecipe } }));
    await quietly(() => catalog.saveRecipe(nextRecipe));
  },

  setServings: async (recipeId, servings) => {
    const recipe = get().recipes[recipeId];
    if (recipe === undefined || !Number.isFinite(servings) || servings <= 0) return;
    const nextRecipe: Recipe = { ...recipe, servings };
    set((s) => ({ recipes: { ...s.recipes, [recipeId]: nextRecipe } }));
    await quietly(() => catalog.saveRecipe(nextRecipe));
  },

  updateSettings: async (patch) => {
    const settings = get().settings;
    if (settings === null) return;
    const next = { ...settings, ...patch };
    set({ settings: next });
    await quietly(() => mealsStore.saveSettings(next));
  },

  generate: async () => {
    const { items, settings, plan, recipes } = get();
    if (settings === null) return;
    const next = generateWeek(items, new Map(Object.entries(recipes)), settings, plan, rng);
    set({ plan: next, breakdownIndex: null });
    await quietly(() => mealsStore.writeWeek(next));
  },

  reroll: async (index) => {
    const { items, settings, plan, recipes } = get();
    if (settings === null) return;
    const next = rerollDay(items, new Map(Object.entries(recipes)), settings, plan, index, rng);
    if (next === plan) return;
    set({ plan: next });
    await quietly(() => mealsStore.writeWeek(next));
  },

  toggleLock: async (index) => {
    const plan = get().plan.map((entry, i) =>
      i === index ? { ...entry, locked: !entry.locked } : entry,
    );
    set({ plan });
    await quietly(() => mealsStore.writeWeek(plan));
  },

  commit: async () => {
    const { items, settings, plan } = get();
    if (settings === null) return;
    const committed = commitWeek(items, plan);
    const weekStart = committed.nextWeekStart ?? settings.weekStart;
    const nextSettings = { ...settings, weekStart };
    set({ items: committed.items, settings: nextSettings, breakdownIndex: null });
    await quietly(() => mealsStore.saveItems(committed.items));
    await quietly(() => mealsStore.saveSettings(nextSettings));
    set({ plan: await mealsStore.readWeek(weekStart) });
  },

  showBreakdown: (index) => set({ breakdownIndex: index }),
}));
