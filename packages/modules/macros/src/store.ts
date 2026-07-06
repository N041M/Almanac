import type { Clock, DayStore, ISODate, StoragePort } from '@almanac/core';
import type { MacroSet } from '@almanac/food';
import { MACRO_FIELDS, type MacroTargets } from './types.js';
import { macrosDayCodec, type MacrosDaySlice } from './slice.js';

// The module's own (non-day) state: the daily targets under one key, a
// versioned envelope like every slice (§11). Reads never throw — a corrupt or
// unknown-version payload degrades to empty targets in isolation (L5).

const TARGETS_KEY = 'macros:targets';
export const MACROS_TARGETS_VERSION = 1;

interface Envelope {
  v: number;
  d: unknown;
  m?: number;
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'v' in value && 'd' in value;
}

function decodeTargets(value: unknown): MacroTargets {
  if (typeof value !== 'object' || value === null) return {};
  const record = value as Record<string, unknown>;
  const out: MacroSet = {};
  for (const field of MACRO_FIELDS) {
    const n = record[field];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[field] = n;
  }
  return out;
}

/**
 * The macros module's persistence: editable targets under a module key, and the
 * per-day intake log as a day slice (the shared surface the calendar reads, §5).
 * The planned meal's macros are derived on read, never stored. Framework-free.
 */
export interface MacrosStore {
  getTargets(): Promise<MacroTargets>;
  saveTargets(targets: MacroTargets): Promise<void>;
  /** One day's log (absent/corrupt reads as the empty slice, L5). */
  readDay(date: ISODate): Promise<MacrosDaySlice>;
  writeDay(date: ISODate, slice: MacrosDaySlice): Promise<void>;
}

export function createMacrosStore(
  storage: StoragePort,
  dayStore: DayStore,
  clock?: Clock,
): MacrosStore {
  return {
    getTargets: async () => {
      let raw: string | null;
      try {
        raw = await storage.read(TARGETS_KEY);
      } catch {
        return {};
      }
      if (raw === null) return {};
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isEnvelope(parsed) || parsed.v !== MACROS_TARGETS_VERSION) return {};
        return decodeTargets(parsed.d);
      } catch {
        return {};
      }
    },
    saveTargets: async (targets) => {
      const envelope: Envelope = {
        v: MACROS_TARGETS_VERSION,
        d: targets,
        ...(clock !== undefined ? { m: clock.now() } : {}),
      };
      await storage.write(TARGETS_KEY, JSON.stringify(envelope));
    },
    readDay: (date) => dayStore.readSlice(date, macrosDayCodec),
    writeDay: (date, slice) => dayStore.writeSlice(date, macrosDayCodec, slice),
  };
}
