import type { SliceCodec } from '@almanac/core';
import type { MacroSet } from '@almanac/food';
import { MACRO_FIELDS, type MacroEntry } from './types.js';

/**
 * The macros module's contribution to a Day: the manually logged intake and how
 * much of the day's planned meal counted as eaten. The planned meal's macros
 * are derived on read (never stored), so this slice holds only what the user
 * entered. Corrupt/unknown-version payloads degrade to the default in isolation
 * (L5); within a payload, one malformed entry is dropped, not the whole log.
 */
export interface MacrosDaySlice {
  entries: MacroEntry[];
  /** Servings of the planned meal eaten; 0 excludes it, absent ⇒ 1. */
  plannedServings: number;
}

export const MACROS_NAMESPACE = 'macros';
export const MACROS_SLICE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Keep only the finite macro fields; anything else is simply absent (L5). */
function decodeMacroSet(value: unknown): MacroSet {
  if (!isRecord(value)) return {};
  const out: MacroSet = {};
  for (const field of MACRO_FIELDS) {
    const n = value[field];
    if (typeof n === 'number' && Number.isFinite(n)) out[field] = n;
  }
  return out;
}

function decodeEntry(value: unknown): MacroEntry | null {
  if (!isRecord(value) || typeof value['id'] !== 'string') return null;
  const label = typeof value['label'] === 'string' ? value['label'] : '';
  return { id: value['id'], label, macros: decodeMacroSet(value['macros']) };
}

export const macrosDayCodec: SliceCodec<MacrosDaySlice> = {
  namespace: MACROS_NAMESPACE,
  version: MACROS_SLICE_VERSION,
  default: () => ({ entries: [], plannedServings: 1 }),
  decode: (raw) => {
    if (!isRecord(raw)) throw new Error('macros slice: not an object');
    const rawEntries = Array.isArray(raw['entries']) ? raw['entries'] : [];
    // A malformed entry costs only itself — the rest of the log stands (L5).
    const entries = rawEntries
      .map(decodeEntry)
      .filter((entry): entry is MacroEntry => entry !== null);
    const servings = raw['plannedServings'];
    const plannedServings =
      typeof servings === 'number' && Number.isFinite(servings) && servings >= 0 ? servings : 1;
    return { entries, plannedServings };
  },
  encode: (value) => value,
};
