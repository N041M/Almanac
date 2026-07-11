import type { ISODate, Rng } from '@almanac/core';
import { addDays, weekdayOf } from '@almanac/core';
import type { Recipe } from '@almanac/food';
import type { PlanEntry, PlanItem, Settings, SlotEntry, WeekPlan } from './types.js';
import { emptySlotEntry } from './types.js';
import { selectSlot } from './select-slot.js';

/** Weekday keys by `weekdayOf` index (0 = Sunday) — views translate (L7). */
const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export function dayNameOf(date: ISODate): string {
  return DAY_NAMES[weekdayOf(date)];
}

/** Tags of a recipe id; empty for null/missing (L5). */
function tagsOf(recipeId: string | null, recipes: ReadonlyMap<string, Recipe>): ReadonlySet<string> {
  if (recipeId === null) return new Set();
  return new Set(recipes.get(recipeId)?.tags ?? []);
}

/**
 * §6.5 `generateWeek`, generalized from one meal per day to one per **cell**
 * (day × meal slot). The algorithm is unchanged — gates → scorers → draw per
 * cell — only the loop is now day-major over `slotIds`, sharing cooldown/used/
 * tag history across every cell. History = committed `lastServed` only (the
 * visible plan is never folded back in). Pass 1 keeps locked cells verbatim;
 * pass 2 fills the rest, relaxing per the ladder. Never throws; an unfillable
 * cell stays `recipeId: null`.
 *
 * `avoidSameTag` now compares each cell against the **previous cell in order**
 * (within a day: the prior meal; across days: the last meal of the day before).
 */
export function generateWeek(
  items: ReadonlyArray<PlanItem>,
  recipes: ReadonlyMap<string, Recipe>,
  settings: Settings,
  slotIds: ReadonlyArray<string>,
  prevPlan: WeekPlan,
  rng: Rng,
): WeekPlan {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(settings.weekStart, i));
  const working = new Map<string, ISODate>();
  for (const item of items) {
    if (item.lastServed !== null) working.set(item.recipeId, item.lastServed);
  }
  const used = new Set<string>();
  const prevByDate = new Map(prevPlan.map((entry) => [entry.date, entry]));

  const plan: PlanEntry[] = dates.map((date) => ({
    dayName: dayNameOf(date),
    date,
    slots: {},
  }));

  // Pass 1 — locked cells stand exactly as they are, and count as placed.
  dates.forEach((date, di) => {
    const prev = prevByDate.get(date);
    const entry = plan[di];
    if (entry === undefined || prev === undefined) return;
    for (const slotId of slotIds) {
      const cell = prev.slots[slotId];
      if (cell?.locked !== true) continue;
      entry.slots[slotId] = { ...cell };
      if (cell.recipeId !== null) {
        working.set(cell.recipeId, date);
        used.add(cell.recipeId);
      }
    }
  });

  // Pass 2 — fill the open cells in order; `previousTags` follows the sequence.
  let previousTags: ReadonlySet<string> = new Set();
  dates.forEach((date, di) => {
    const entry = plan[di];
    if (entry === undefined) return;
    for (const slotId of slotIds) {
      const existing = entry.slots[slotId];
      if (existing !== undefined) {
        previousTags = tagsOf(existing.recipeId, recipes);
        continue;
      }
      const selected = selectSlot(
        items,
        recipes,
        date,
        slotId,
        working,
        used,
        previousTags,
        settings,
        rng,
      );
      if (selected !== null) {
        working.set(selected.recipeId, date);
        used.add(selected.recipeId);
      }
      const cell: SlotEntry =
        selected === null
          ? emptySlotEntry()
          : { recipeId: selected.recipeId, locked: false, breakdown: selected.breakdown };
      entry.slots[slotId] = cell;
      previousTags = tagsOf(cell.recipeId, recipes);
    }
  });

  return plan;
}
