import type { MacroSet } from '@almanac/food';
import { MACRO_FIELDS } from './types.js';

/**
 * Add macro sets field by field. Purely additive per field: a macro appears in
 * the total only if at least one input carried a finite value, so sparse data
 * stays sparse rather than reading as 0 (L5).
 */
export function sumMacros(sets: readonly MacroSet[]): MacroSet {
  const total: MacroSet = {};
  for (const set of sets) {
    for (const field of MACRO_FIELDS) {
      const value = set[field];
      if (value === undefined || !Number.isFinite(value)) continue;
      total[field] = (total[field] ?? 0) + value;
    }
  }
  return total;
}

/** Scale every present field by a factor (e.g. servings eaten). NaN factor ⇒ empty. */
export function scaleMacros(set: MacroSet, factor: number): MacroSet {
  if (!Number.isFinite(factor)) return {};
  const out: MacroSet = {};
  for (const field of MACRO_FIELDS) {
    const value = set[field];
    if (value !== undefined && Number.isFinite(value)) out[field] = value * factor;
  }
  return out;
}

/**
 * targets − intake, per field where a target exists (untargeted macros stay
 * absent — you only track what you set a target for). Negative = over target.
 */
export function remainingMacros(targets: MacroSet, intake: MacroSet): MacroSet {
  const out: MacroSet = {};
  for (const field of MACRO_FIELDS) {
    const target = targets[field];
    if (target === undefined || !Number.isFinite(target)) continue;
    out[field] = target - (intake[field] ?? 0);
  }
  return out;
}
