// @almanac/macros — daily intake vs. targets (§8). Depends on @almanac/core and
// @almanac/food only — never another module (L1): the planned meal is read off
// the shared Day record and its macros derived via the food kernel, not by
// importing meals. Pure and deterministic (L3/L4); intake is derived on demand.

export type { MacroEntry, MacroField, MacroTargets, DayMacros } from './types.js';
export { MACRO_FIELDS } from './types.js';
export { sumMacros, scaleMacros, remainingMacros } from './macro-math.js';
export type { DayMacrosInput } from './compute.js';
export { computeDayMacros } from './compute.js';
export type { MacrosDaySlice } from './slice.js';
export { MACROS_NAMESPACE, MACROS_SLICE_VERSION, macrosDayCodec } from './slice.js';
export type { MacrosStore } from './store.js';
export { MACROS_TARGETS_VERSION, createMacrosStore } from './store.js';
export { macrosManifest } from './manifest.js';

export const MACROS_MODULE_VERSION = '0.0.0';
