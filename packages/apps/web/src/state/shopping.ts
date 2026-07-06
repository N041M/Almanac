import { create } from 'zustand';
import { addDays, type ISODate, type Recurrence, type SliceCodec, type Weekday } from '@almanac/core';
import { mealsDayCodec } from '@almanac/meals';
import {
  aggregateWindow,
  scheduledWindows,
  shoppingNowWindow,
  type ShoppingList,
  type ShoppingSettings,
  type ShoppingWindow,
} from '@almanac/shopping';
import { catalog, quietly } from './meals-services';
import { dayStore } from './persistence';
import { shoppingStore } from './shopping-services';
import { today } from '../clock';

// A fixed Monday; an interval-1 weekly rule matches every week, so the start's
// own weekday is irrelevant — `byWeekday` alone picks the shopping day.
const SCHEDULE_START = '2020-01-06' as ISODate;
/** How far ahead the "scheduled trips" list looks. */
const TRIP_HORIZON_DAYS = 27;

/** One thing the user added by hand — session-only, grouped apart from the plan. */
export interface ManualItem {
  id: string;
  name: string;
}

function weekdayRecurrence(weekday: Weekday): Recurrence {
  return { freq: 'weekly', start: SCHEDULE_START, byWeekday: [weekday] };
}

/** The configured shopping weekday, or null when only the ad-hoc trigger is set. */
export function shoppingWeekday(settings: ShoppingSettings | null): Weekday | null {
  const wd = settings?.recurrence?.byWeekday?.[0];
  return wd ?? null;
}

async function computeList(window: ShoppingWindow): Promise<ShoppingList> {
  // The app may read across modules (L1 binds modules, not the shell): it uses
  // the meals codec to load the plan slices, then hands them to the pure engine.
  const [recipeList, ingredientList, days] = await Promise.all([
    catalog.listRecipes(),
    catalog.listIngredients(),
    dayStore.getRange(window.start, window.end, [mealsDayCodec as SliceCodec<unknown>]),
  ]);
  return aggregateWindow(window, days, {
    recipesById: new Map(recipeList.map((r) => [r.id, r])),
    ingredientsById: new Map(ingredientList.map((i) => [i.id, i])),
  });
}

function computeTrips(settings: ShoppingSettings): ShoppingWindow[] {
  if (settings.recurrence === undefined) return [];
  return scheduledWindows(
    settings.recurrence,
    today(),
    addDays(today(), TRIP_HORIZON_DAYS),
    settings.horizonDays,
  );
}

export interface ShoppingState {
  loaded: boolean;
  loading: boolean;
  settings: ShoppingSettings | null;
  /** The window whose list is currently shown. */
  window: ShoppingWindow | null;
  list: ShoppingList | null;
  /** Upcoming scheduled trips (empty when no shopping day is set). */
  trips: ShoppingWindow[];
  /** Session check-off, keyed by ingredient id. */
  checked: Readonly<Record<string, boolean>>;
  /** Session manual additions. */
  manual: ManualItem[];

  load: () => Promise<void>;
  /** Recompute the ad-hoc "shopping now" window from today (§8.1, 2nd trigger). */
  shopNow: () => Promise<void>;
  /** View one scheduled trip's list (§8.1, 1st trigger). */
  viewTrip: (window: ShoppingWindow) => Promise<void>;
  setShoppingDay: (weekday: Weekday | null) => Promise<void>;
  setHorizon: (days: number) => Promise<void>;
  toggleChecked: (ingredientId: string) => void;
  addManual: (name: string) => void;
  removeManual: (id: string) => void;
}

export const useShopping = create<ShoppingState>((set, get) => {
  async function saveSettings(next: ShoppingSettings): Promise<void> {
    set({ settings: next, trips: computeTrips(next) });
    await quietly(() => shoppingStore.saveSettings(next));
  }

  async function show(window: ShoppingWindow): Promise<void> {
    set({ window });
    const list = await computeList(window);
    // A late generate for a superseded window must not clobber a newer one.
    if (get().window?.start === window.start && get().window?.end === window.end) {
      set({ list });
    }
  }

  return {
    loaded: false,
    loading: false,
    settings: null,
    window: null,
    list: null,
    trips: [],
    checked: {},
    manual: [],

    load: async () => {
      if (get().loaded || get().loading) return;
      set({ loading: true });
      try {
        const settings = await shoppingStore.getSettings();
        set({ loaded: true, settings, trips: computeTrips(settings) });
        await show(shoppingNowWindow(today(), settings.recurrence, settings.horizonDays));
      } finally {
        set({ loading: false });
      }
    },

    shopNow: async () => {
      const settings = get().settings;
      if (settings === null) return;
      await show(shoppingNowWindow(today(), settings.recurrence, settings.horizonDays));
    },

    viewTrip: async (window) => {
      await show(window);
    },

    setShoppingDay: async (weekday) => {
      const settings = get().settings;
      if (settings === null) return;
      const next: ShoppingSettings =
        weekday === null
          ? { horizonDays: settings.horizonDays }
          : { horizonDays: settings.horizonDays, recurrence: weekdayRecurrence(weekday) };
      await saveSettings(next);
      await get().shopNow();
    },

    setHorizon: async (days) => {
      const settings = get().settings;
      if (settings === null || !Number.isFinite(days) || days < 1) return;
      const next: ShoppingSettings = { ...settings, horizonDays: Math.floor(days) };
      await saveSettings(next);
      await get().shopNow();
    },

    toggleChecked: (ingredientId) =>
      set((s) => ({ checked: { ...s.checked, [ingredientId]: !s.checked[ingredientId] } })),

    addManual: (name) => {
      const trimmed = name.trim();
      if (trimmed === '') return; // empty add: a quiet no-op (L5)
      set((s) => ({ manual: [...s.manual, { id: crypto.randomUUID(), name: trimmed }] }));
    },

    removeManual: (id) => set((s) => ({ manual: s.manual.filter((m) => m.id !== id) })),
  };
});
