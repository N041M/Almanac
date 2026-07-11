import type { ISODate, Rng } from '@almanac/core';
import type { Recipe } from '@almanac/food';
import type { PlanItem, Settings, WeekPlan } from './types.js';
import { selectSlot } from './select-slot.js';

/** Tags of the cell immediately before (dayIndex, slotId) in day-major order. */
function previousCellTags(
  plan: WeekPlan,
  slotIds: ReadonlyArray<string>,
  dayIndex: number,
  slotId: string,
  recipes: ReadonlyMap<string, Recipe>,
): ReadonlySet<string> {
  const slotIndex = slotIds.indexOf(slotId);
  const prevEntry = slotIndex > 0 ? plan[dayIndex] : plan[dayIndex - 1];
  const prevSlotId = slotIndex > 0 ? slotIds[slotIndex - 1] : slotIds[slotIds.length - 1];
  const recipeId =
    prevSlotId === undefined ? null : (prevEntry?.slots[prevSlotId]?.recipeId ?? null);
  return new Set(recipeId === null ? [] : (recipes.get(recipeId)?.tags ?? []));
}

/**
 * §6.5 re-roll, per **cell** (day × meal slot): re-pick one slot against every
 * other cell + committed history, excluding the current pick when alternatives
 * exist. Same ladder as generation. A locked, missing, or out-of-range cell
 * returns the plan unchanged (quietly, L5); an unfillable cell becomes
 * `recipeId: null`.
 */
export function rerollCell(
  items: ReadonlyArray<PlanItem>,
  recipes: ReadonlyMap<string, Recipe>,
  settings: Settings,
  slotIds: ReadonlyArray<string>,
  plan: WeekPlan,
  dayIndex: number,
  slotId: string,
  rng: Rng,
): WeekPlan {
  const entry = plan[dayIndex];
  const cell = entry?.slots[slotId];
  if (entry === undefined || cell === undefined || cell.locked) return plan;

  const working = new Map<string, ISODate>();
  for (const item of items) {
    if (item.lastServed !== null) working.set(item.recipeId, item.lastServed);
  }
  const used = new Set<string>();
  plan.forEach((e, di) => {
    for (const [sid, s] of Object.entries(e.slots)) {
      if (di === dayIndex && sid === slotId) continue; // the cell being re-rolled
      if (s.recipeId === null) continue;
      working.set(s.recipeId, e.date);
      used.add(s.recipeId);
    }
  });

  const selected = selectSlot(
    items,
    recipes,
    entry.date,
    slotId,
    working,
    used,
    previousCellTags(plan, slotIds, dayIndex, slotId, recipes),
    settings,
    rng,
    cell.recipeId ?? undefined,
  );

  return plan.map((e, di) =>
    di === dayIndex
      ? {
          ...e,
          slots: {
            ...e.slots,
            [slotId]: {
              recipeId: selected?.recipeId ?? null,
              locked: false,
              breakdown: selected?.breakdown ?? null,
            },
          },
        }
      : e,
  );
}
