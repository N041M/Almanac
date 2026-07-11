import type { ISODate } from '@almanac/core';

/**
 * The engine's data model, exactly §6.1. A meal's *food* attributes live in
 * the food kernel as a `Recipe`; these are its *planning* attributes, linked
 * by `recipeId` — the engine reads tags from the linked recipe.
 */
export interface PlanItem {
  recipeId: string;
  /** Frequency multiplier; presets 0.4 / 1 / 2 / 3.5 (`WEIGHT_PRESETS`). */
  weight: number;
  /** null ⇒ use `Settings.defaultCooldown`. */
  cooldownDays: number | null;
  enabled: boolean;
  /** Committed history only — the visible plan is never folded back in (§6.5). */
  lastServed: ISODate | null;
  /**
   * Eligible meal-slot ids (e.g. `['breakfast']`). Empty/absent ⇒ any slot —
   * the slot-type gate only bites for recipes that opt in, and relaxes to "any"
   * when a slot would otherwise go empty (L5). A §6 additive extension.
   */
  slots?: string[];
}

export interface Settings {
  /** Days. */
  defaultCooldown: number;
  /** 0..1 slider — the sampling temperature (§6.4). */
  variety: number;
  noWeekRepeat: boolean;
  avoidSameTag: boolean;
  /** Locale-driven week start (the plan's first day). */
  weekStart: ISODate;
}

/** The "why this pick" panel's data (§6.6) — recorded at draw time. */
export interface SelectionBreakdown {
  prob: number;
  candidateCount: number;
  fFreq: number;
  fRec: number;
  fTag: number;
  /** null ⇒ never served. */
  daysSince: number | null;
  alternatives: { id: string; name: string; p: number }[];
}

/**
 * One meal-slot's selection on a day. `recipeId: null` = an empty slot (the
 * ladder's last rung, §6.5) — a normal state. Lock and "why this pick" are
 * per-slot now that a day holds several meals.
 */
export interface SlotEntry {
  recipeId: string | null;
  locked: boolean;
  breakdown: SelectionBreakdown | null;
}

export interface PlanEntry {
  /** Weekday key ("monday" … "sunday") — views translate it (L7). */
  dayName: string;
  date: ISODate;
  /** One entry per configured meal slot, keyed by slot id. */
  slots: Record<string, SlotEntry>;
}

/** Length 7, `Settings.weekStart` .. +6. */
export type WeekPlan = PlanEntry[];

/** An empty slot — the default and the ladder's last rung (§6.5). */
export function emptySlotEntry(): SlotEntry {
  return { recipeId: null, locked: false, breakdown: null };
}
