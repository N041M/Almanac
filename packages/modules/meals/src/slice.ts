import type { SliceCodec } from '@almanac/core';
import type { SelectionBreakdown, SlotEntry } from './engine/types.js';
import { LEGACY_SLOT_ID } from './slots.js';

/**
 * The meals module's contribution to a Day (§5): the planned meals, one per
 * configured slot, keyed by slot id. The day-store guarantees a corrupt or
 * unknown-version payload degrades to the default without touching other
 * slices (L5); within a payload, one malformed slot is dropped, not the day.
 */
export interface MealsDaySlice {
  slots: Record<string, SlotEntry>;
}

export const MEALS_NAMESPACE = 'meals';
export const MEALS_SLICE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFinite_(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function decodeBreakdown(value: unknown): SelectionBreakdown | null {
  if (!isRecord(value)) return null;
  const { prob, candidateCount, fFreq, fRec, fTag, daysSince, alternatives } = value;
  if (!isFinite_(prob) || !isFinite_(candidateCount)) return null;
  if (!isFinite_(fFreq) || !isFinite_(fRec) || !isFinite_(fTag)) return null;
  if (daysSince !== null && !isFinite_(daysSince)) return null;
  if (!Array.isArray(alternatives)) return null;
  const alts: SelectionBreakdown['alternatives'] = [];
  for (const alt of alternatives) {
    if (!isRecord(alt)) return null;
    if (typeof alt['id'] !== 'string' || typeof alt['name'] !== 'string' || !isFinite_(alt['p'])) {
      return null;
    }
    alts.push({ id: alt['id'], name: alt['name'], p: alt['p'] });
  }
  return { prob, candidateCount, fFreq, fRec, fTag, daysSince, alternatives: alts };
}

/** One slot entry, or null when the shape is unusable (dropped, L5). */
function decodeSlotEntry(value: unknown): SlotEntry | null {
  if (!isRecord(value)) return null;
  const recipeId = value['recipeId'];
  if (recipeId !== null && typeof recipeId !== 'string') return null;
  return {
    recipeId,
    locked: value['locked'] === true,
    breakdown: decodeBreakdown(value['breakdown']),
  };
}

export const mealsDayCodec: SliceCodec<MealsDaySlice> = {
  namespace: MEALS_NAMESPACE,
  version: MEALS_SLICE_VERSION,
  default: () => ({ slots: {} }),
  decode: (raw) => {
    if (!isRecord(raw)) throw new Error('meals slice: not an object');

    // New shape: a `slots` map (a malformed slot is dropped, not the day).
    if (isRecord(raw['slots'])) {
      const slots: Record<string, SlotEntry> = {};
      for (const [slotId, value] of Object.entries(raw['slots'])) {
        const entry = decodeSlotEntry(value);
        if (entry !== null) slots[slotId] = entry;
      }
      return { slots };
    }

    // Legacy single-meal shape → the dinner slot (the day's main meal).
    if ('recipeId' in raw) {
      const entry = decodeSlotEntry(raw);
      return { slots: entry === null ? {} : { [LEGACY_SLOT_ID]: entry } };
    }

    return { slots: {} };
  },
  encode: (value) => value,
};
