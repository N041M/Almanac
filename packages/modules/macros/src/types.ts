import type { MacroSet } from '@almanac/food';

/** The macros this module accounts (kcal + the three macronutrients, §8). */
export const MACRO_FIELDS = ['kcal', 'proteinG', 'carbsG', 'fatG'] as const;
export type MacroField = (typeof MACRO_FIELDS)[number];

/** One manually logged intake item on a day. */
export interface MacroEntry {
  id: string;
  label: string;
  macros: MacroSet;
}

/** Editable daily targets (§8: manual, or later goal-derived). */
export type MacroTargets = MacroSet;

/**
 * A day's computed macro picture — pure derived data (the planned meal isn't
 * copied into storage, so it stays in sync when the recipe changes). Every
 * field is sparse: a macro appears only where something contributed it, never
 * reading as a hard 0 (L5, matching the food kernel's nutrition posture).
 */
export interface DayMacros {
  /** Total intake = planned meal + manual entries. */
  intake: MacroSet;
  fromPlan: MacroSet;
  fromManual: MacroSet;
  /** targets − intake, per field where a target exists; negative = over target. */
  remaining: MacroSet;
}
