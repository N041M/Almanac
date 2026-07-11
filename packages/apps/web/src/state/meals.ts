import { create } from 'zustand';
import { diffDays, startOfWeek, type ISODate, type NutritionResult } from '@almanac/core';
import { sameFoodName, type Ingredient, type Recipe } from '@almanac/food';
import {
  WEIGHT_PRESETS,
  commitWeek,
  generateWeek,
  rerollCell,
  type MealSlot,
  type MealsDaySlice,
  type PlanItem,
  type Settings,
  type SlotEntry,
  type WeekPlan,
} from '@almanac/meals';
import { seedStarterMeals } from './seed-meals';
import { storagePort } from './persistence';
import { useCalendar } from './store';
import { useUndo } from './undo';
import { today } from '../clock';
import {
  EMPTY_SLICE,
  catalog,
  currentWeekStart,
  mealsStore,
  quietly,
  rng,
  type WeightPreset,
} from './meals-services';
import { createNutritionActions } from './meals-nutrition';

export type { WeightPreset } from './meals-services';
export { presetOf } from './meals-services';

/** Which cell's "why this pick" panel is open. */
export interface BreakdownCell {
  dayIndex: number;
  slotId: string;
}

/** A fresh (unlocked, un-explained) copy of a day's non-empty slots. */
function freshSlots(slots: Record<string, SlotEntry>): Record<string, SlotEntry> {
  const out: Record<string, SlotEntry> = {};
  for (const [id, cell] of Object.entries(slots)) {
    if (cell.recipeId !== null) out[id] = { recipeId: cell.recipeId, locked: false, breakdown: null };
  }
  return out;
}

const hasAnyMeal = (slots: Record<string, SlotEntry>): boolean =>
  Object.values(slots).some((cell) => cell.recipeId !== null);
const isDayLocked = (slots: Record<string, SlotEntry>): boolean =>
  Object.values(slots).some((cell) => cell.locked);

export interface MealsState {
  loaded: boolean;
  /** True while the initial load is in flight (re-entrancy guard). */
  loading: boolean;
  /** The Monday of the week the meals screen is looking at. */
  viewWeek: ISODate;
  recipes: Readonly<Record<string, Recipe>>;
  ingredients: Readonly<Record<string, Ingredient>>;
  items: PlanItem[];
  settings: Settings | null;
  /** Configured meal slots (default Breakfast/Lunch/Dinner). */
  slots: MealSlot[];
  plan: WeekPlan;
  /** Which cell's breakdown panel is open. */
  breakdownCell: BreakdownCell | null;
  /** Per ingredient: the OFF products its nutrition guess can come from (session-only). */
  nutritionChoices: Readonly<Record<string, NutritionResult[]>>;
  /** Per ingredient: which choice is applied (null = "no match" chosen). */
  nutritionPick: Readonly<Record<string, number | null>>;
  /** Read-through cache of day slices outside the loaded plan week. */
  dayMeals: Readonly<Record<ISODate, MealsDaySlice>>;
  /** The copied day of meals, ready to paste onto any day. */
  mealClipboard: MealsDaySlice | null;

  load: () => Promise<void>;
  addMeal: (name: string, tags: string, preset: WeightPreset) => Promise<void>;
  removeMeal: (recipeId: string) => Promise<void>;
  updateItem: (recipeId: string, patch: Partial<PlanItem>) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  /** Replace the meal-slot configuration (types/count). */
  setSlots: (slots: ReadonlyArray<MealSlot>) => Promise<void>;
  addIngredient: (recipeId: string, name: string, amount: number, unit: string) => Promise<void>;
  removeIngredient: (recipeId: string, line: number) => Promise<void>;
  setServings: (recipeId: string, servings: number) => Promise<void>;
  guessNutrition: (ingredientId: string) => Promise<void>;
  guessAllNutrition: (recipeId: string) => Promise<void>;
  applyNutrition: (ingredientId: string, choice: number | null) => Promise<void>;
  /** Re-roll the whole week (keeps locked cells) — the "Re-roll week" action. */
  generate: () => Promise<void>;
  /** Re-roll one cell (day × slot). */
  reroll: (dayIndex: number, slotId: string) => Promise<void>;
  toggleLock: (dayIndex: number, slotId: string) => Promise<void>;
  commit: () => Promise<void>;
  showBreakdown: (cell: BreakdownCell | null) => void;
  goToWeek: (date: ISODate) => Promise<void>;
  resetToCurrentWeek: () => Promise<void>;
  loadDayMeal: (date: ISODate) => Promise<void>;
  copyMeal: (date: ISODate) => void;
  pasteMeal: (date: ISODate) => Promise<void>;
  cutMeal: (date: ISODate) => Promise<void>;
  moveMeal: (from: ISODate, to: ISODate) => Promise<void>;
}

export const useMeals = create<MealsState>((set, get) => {
  const { guessNutrition, guessAllNutrition, applyNutrition } = createNutritionActions(set, get);

  /** The whole day's slots (plan-first; cache for out-of-week days). */
  function currentSlice(date: ISODate): MealsDaySlice {
    const s = get();
    const entry = s.plan.find((e) => e.date === date);
    if (entry !== undefined) return { slots: entry.slots };
    return s.dayMeals[date] ?? EMPTY_SLICE;
  }

  /**
   * Write one day's slice everywhere it lives: plan entry or day cache, storage
   * (quietly, L5), and the calendar's day records. Undo entries close over this.
   */
  async function applyDay(date: ISODate, slice: MealsDaySlice): Promise<void> {
    set((s) => {
      const inPlan = s.plan.some((e) => e.date === date);
      return {
        plan: inPlan ? s.plan.map((e) => (e.date === date ? { ...e, slots: slice.slots } : e)) : s.plan,
        dayMeals: inPlan ? s.dayMeals : { ...s.dayMeals, [date]: slice },
      };
    });
    await quietly(() => mealsStore.writeDay(date, slice));
    void useCalendar.getState().invalidateDays();
  }

  return {
    loaded: false,
    loading: false,
    viewWeek: currentWeekStart(),
    recipes: {},
    ingredients: {},
    items: [],
    settings: null,
    slots: [],
    plan: [],
    breakdownCell: null,
    nutritionChoices: {},
    nutritionPick: {},
    dayMeals: {},
    mealClipboard: null,

    load: async () => {
      if (get().loaded || get().loading) return;
      set({ loading: true });
      try {
        if (import.meta.env.MODE !== 'test') {
          await seedStarterMeals(storagePort, catalog, mealsStore);
        }
        const settings = await mealsStore.getSettings(currentWeekStart());
        const viewWeek = get().viewWeek;
        const [recipeList, ingredientList, items, slots, plan] = await Promise.all([
          catalog.listRecipes(),
          catalog.listIngredients(),
          mealsStore.getItems(),
          mealsStore.getSlots(),
          mealsStore.readWeek(viewWeek),
        ]);
        const recipes: Record<string, Recipe> = {};
        for (const recipe of recipeList) recipes[recipe.id] = recipe;
        const ingredients: Record<string, Ingredient> = {};
        for (const ingredient of ingredientList) ingredients[ingredient.id] = ingredient;
        set({ loaded: true, recipes, ingredients, items, settings, slots, plan });
      } finally {
        set({ loading: false });
      }
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

      const existing = Object.values(get().ingredients).find((candidate) =>
        sameFoodName(candidate.name, trimmed),
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
        ingredients:
          existing !== undefined ? s.ingredients : { ...s.ingredients, [ingredient.id]: ingredient },
      }));
      if (existing === undefined) {
        await quietly(() => catalog.saveIngredient(ingredient));
        void get().guessNutrition(ingredient.id);
      }
      await quietly(() => catalog.saveRecipe(nextRecipe));
    },

    guessNutrition,
    guessAllNutrition,
    applyNutrition,

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

    setSlots: async (slots) => {
      const next = [...slots];
      set({ slots: next });
      await quietly(() => mealsStore.saveSlots(next));
    },

    generate: async () => {
      const { items, settings, plan, recipes, viewWeek, slots } = get();
      if (settings === null) return;
      const before = plan;
      const next = generateWeek(
        items,
        new Map(Object.entries(recipes)),
        { ...settings, weekStart: viewWeek },
        slots.map((s) => s.id),
        plan,
        rng,
      );
      set({ plan: next, breakdownCell: null, dayMeals: {} });
      await quietly(() => mealsStore.writeWeek(next));
      void useCalendar.getState().invalidateDays();
      if (before.length > 0) {
        useUndo.getState().push({
          labelKey: 'meals:rerollWeek',
          apply: async () => {
            set({ plan: before, breakdownCell: null });
            await quietly(() => mealsStore.writeWeek(before));
            void useCalendar.getState().invalidateDays();
          },
        });
      }
    },

    reroll: async (dayIndex, slotId) => {
      const { items, settings, plan, recipes, slots } = get();
      if (settings === null) return;
      const before = plan[dayIndex];
      const next = rerollCell(
        items,
        new Map(Object.entries(recipes)),
        settings,
        slots.map((s) => s.id),
        plan,
        dayIndex,
        slotId,
        rng,
      );
      if (next === plan) return;
      set({ plan: next });
      const entry = next[dayIndex];
      if (entry !== undefined) {
        await quietly(() => mealsStore.writeDay(entry.date, { slots: entry.slots }));
        void useCalendar.getState().invalidateDays();
      }
      if (before !== undefined) {
        useUndo.getState().push({
          labelKey: 'meals:rerollDay',
          apply: () => applyDay(before.date, { slots: before.slots }),
        });
      }
    },

    toggleLock: async (dayIndex, slotId) => {
      const entry = get().plan[dayIndex];
      const cell = entry?.slots[slotId];
      if (entry === undefined || cell === undefined || cell.recipeId === null) return;
      const before = { slots: entry.slots };
      await applyDay(entry.date, {
        slots: { ...entry.slots, [slotId]: { ...cell, locked: !cell.locked } },
      });
      useUndo.getState().push({
        labelKey: cell.locked ? 'meals:unlockDay' : 'meals:lockDay',
        apply: () => applyDay(entry.date, before),
      });
    },

    commit: async () => {
      const { items, settings, plan, viewWeek } = get();
      if (settings === null) return;
      const committed = commitWeek(items, plan);
      const mergedItems = committed.items.map((item) => {
        const prev = items.find((i) => i.recipeId === item.recipeId);
        if (
          prev?.lastServed != null &&
          item.lastServed !== null &&
          diffDays(item.lastServed, prev.lastServed) > 0
        ) {
          return { ...item, lastServed: prev.lastServed };
        }
        return item;
      });
      const advanced = committed.nextWeekStart ?? viewWeek;
      const weekStart = diffDays(settings.weekStart, advanced) > 0 ? advanced : settings.weekStart;
      const nextSettings = { ...settings, weekStart };
      set({
        items: mergedItems,
        settings: nextSettings,
        viewWeek: advanced,
        breakdownCell: null,
        dayMeals: {},
      });
      await quietly(() => mealsStore.saveItems(mergedItems));
      await quietly(() => mealsStore.saveSettings(nextSettings));
      set({ plan: await mealsStore.readWeek(advanced) });
    },

    showBreakdown: (cell) => set({ breakdownCell: cell }),

    goToWeek: async (date) => {
      const viewWeek = startOfWeek(date, 1);
      set({ viewWeek, breakdownCell: null, dayMeals: {} });
      set({ plan: await mealsStore.readWeek(viewWeek) });
    },

    resetToCurrentWeek: async () => {
      await get().goToWeek(today());
    },

    loadDayMeal: async (date) => {
      const { plan, dayMeals } = get();
      if (plan.some((entry) => entry.date === date)) return;
      if (date in dayMeals) return;
      const slice = await mealsStore.readDay(date);
      set((s) => ({ dayMeals: { ...s.dayMeals, [date]: slice } }));
    },

    copyMeal: (date) => {
      const slots = freshSlots(currentSlice(date).slots);
      set({ mealClipboard: hasAnyMeal(slots) ? { slots } : null });
    },

    pasteMeal: async (date) => {
      const { mealClipboard: slice } = get();
      if (slice === null) return; // empty clipboard: a quiet no-op (L5)
      if (isDayLocked(currentSlice(date).slots)) return; // a locked day wins
      const before = currentSlice(date);
      await applyDay(date, slice);
      useUndo.getState().push({ labelKey: 'meals:pasteMeal', apply: () => applyDay(date, before) });
    },

    cutMeal: async (date) => {
      const before = currentSlice(date);
      if (isDayLocked(before.slots) || !hasAnyMeal(before.slots)) return; // quiet no-op (L5)
      set({ mealClipboard: { slots: freshSlots(before.slots) } });
      await applyDay(date, EMPTY_SLICE);
      useUndo.getState().push({ labelKey: 'meals:cutMeal', apply: () => applyDay(date, before) });
    },

    moveMeal: async (from, to) => {
      if (from === to) return;
      const beforeFrom = currentSlice(from);
      const beforeTo = currentSlice(to);
      // A lock protects its day on both ends.
      if (isDayLocked(beforeFrom.slots) || isDayLocked(beforeTo.slots)) return;
      if (!hasAnyMeal(beforeFrom.slots)) return;
      await applyDay(to, { slots: freshSlots(beforeFrom.slots) });
      await applyDay(from, EMPTY_SLICE);
      useUndo.getState().push({
        labelKey: 'meals:moveMeal',
        apply: async () => {
          await applyDay(from, beforeFrom);
          await applyDay(to, beforeTo);
        },
      });
    },
  };
});
