import type { ISODate } from '@almanac/core';
import { diffDays } from '@almanac/core';
import type { PlanItem, Settings } from './types.js';

/**
 * Which gates are active — the relaxation ladder (§6.5) turns these off in a
 * defined order (week-repeat first, then cooldown) instead of ever failing.
 * `enabled` is never relaxed: a disabled meal stays out.
 */
export interface GateFlags {
  /** Restrict a recipe to its eligible meal slots (§6 extension). */
  slotType: boolean;
  cooldown: boolean;
  weekRepeat: boolean;
}

export const ALL_GATES: GateFlags = { slotType: true, cooldown: true, weekRepeat: true };

/** A recipe is eligible for a slot when it declares no slots, or lists this one. */
export function eligibleForSlot(item: PlanItem, slotId: string): boolean {
  return item.slots === undefined || item.slots.length === 0 || item.slots.includes(slotId);
}

/** Absolute day distance from the working date, or `null` if never served/placed. */
export function daysSince(
  item: PlanItem,
  slotDate: ISODate,
  working: ReadonlyMap<string, ISODate>,
): number | null {
  const last = working.get(item.recipeId);
  return last === undefined ? null : Math.abs(diffDays(last, slotDate));
}

/** Hard exclusion (§6.3): enabled → slot-type → cooldown → week-repeat. */
export function passesGates(
  item: PlanItem,
  slotDate: ISODate,
  slotId: string,
  working: ReadonlyMap<string, ISODate>,
  usedThisWeek: ReadonlySet<string>,
  settings: Settings,
  flags: GateFlags,
): boolean {
  if (!item.enabled) return false;

  if (flags.slotType && !eligibleForSlot(item, slotId)) return false;

  if (flags.cooldown) {
    const d = daysSince(item, slotDate, working);
    if (d !== null && d < (item.cooldownDays ?? settings.defaultCooldown)) return false;
  }

  if (flags.weekRepeat && settings.noWeekRepeat && usedThisWeek.has(item.recipeId)) {
    return false;
  }

  return true;
}
