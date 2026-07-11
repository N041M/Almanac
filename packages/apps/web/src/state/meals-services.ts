import { createSeededRng, type ISODate, startOfWeek } from '@almanac/core';
import { createFoodCatalog, createOpenFoodFactsPort } from '@almanac/food';
import { WEIGHT_PRESETS, createMealsStore, type MealsDaySlice } from '@almanac/meals';
import { dayStore, storagePort } from './persistence';
import { systemClock, today } from '../clock';

// Composition root for the meals module (L4 edges live here): the real clock
// seeds the Rng, and the engine itself stays pure and deterministic. Kept out
// of the store file so the store is domain logic, not wiring (one concern).
export const catalog = createFoodCatalog(storagePort, systemClock);
export const mealsStore = createMealsStore(storagePort, dayStore, systemClock);
export const rng = createSeededRng(systemClock.now() >>> 0);

// Nutrition lookup (§7) — enrichment, never a gate: every failure path in the
// adapter resolves to "no data" and the ingredient simply stays fact-less.
// (Browsers drop the User-Agent header; it applies in the Tauri shell.)
export const nutrition = createOpenFoodFactsPort({
  fetchJson: async (url, headers) => {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as unknown;
  },
  userAgent: 'Almanac/0.0 (personal calendar; desktop app)',
  cache: storagePort,
});

export type WeightPreset = keyof typeof WEIGHT_PRESETS;

/** The preset whose weight matches, for showing stored weights as presets. */
export function presetOf(weight: number): WeightPreset {
  const hit = (Object.keys(WEIGHT_PRESETS) as WeightPreset[]).find(
    (key) => WEIGHT_PRESETS[key] === weight,
  );
  return hit ?? 'normal';
}

/** This Monday — engine weeks are Monday-based (§6.1). */
export function currentWeekStart(): ISODate {
  return startOfWeek(today(), 1);
}

export const EMPTY_SLICE: MealsDaySlice = { slots: {} };

/** Persist quietly: a failed write degrades to session-only state (L5). */
export async function quietly(write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch {
    // In-memory state already reflects the action.
  }
}
