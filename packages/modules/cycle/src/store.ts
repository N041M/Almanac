import type { Clock, DayStore, ISODate, SliceCodec, StoragePort } from '@almanac/core';
import { getSlice } from '@almanac/core';
import { cycleDayCodec, CYCLE_NAMESPACE, type CycleDaySlice } from './slice.js';

// The module's own (non-day) state: one settings key, a versioned envelope
// like every slice (§11). Reads never throw — corrupt payloads degrade to the
// default in isolation (L5).

const SETTINGS_KEY = 'cycle:settings';
export const CYCLE_SETTINGS_VERSION = 1;

export interface CycleSettings {
  /** Off ⇒ the module still logs and shows history — prediction is optional (§8). */
  predictionEnabled: boolean;
}

export const DEFAULT_CYCLE_SETTINGS: CycleSettings = { predictionEnabled: true };

interface Envelope {
  v: number;
  d: unknown;
  m?: number;
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'v' in value && 'd' in value;
}

/**
 * The cycle module's persistence: per-day flow as a day slice plus one
 * settings key. Framework-free; the UI layer composes it.
 */
export interface CycleStore {
  getSettings(): Promise<CycleSettings>;
  saveSettings(settings: CycleSettings): Promise<void>;
  /** One day's log (absent/corrupt reads as the empty slice, L5). */
  readDay(date: ISODate): Promise<CycleDaySlice>;
  writeDay(date: ISODate, slice: CycleDaySlice): Promise<void>;
  /** Every day with any log (flow or test) in the range — the stats input. */
  readLoggedDays(from: ISODate, to: ISODate): Promise<Map<ISODate, CycleDaySlice>>;
}

export function createCycleStore(
  storage: StoragePort,
  dayStore: DayStore,
  clock?: Clock,
): CycleStore {
  return {
    getSettings: async () => {
      let raw: string | null;
      try {
        raw = await storage.read(SETTINGS_KEY);
      } catch {
        return DEFAULT_CYCLE_SETTINGS;
      }
      if (raw === null) return DEFAULT_CYCLE_SETTINGS;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isEnvelope(parsed) || parsed.v !== CYCLE_SETTINGS_VERSION) {
          return DEFAULT_CYCLE_SETTINGS;
        }
        const d = parsed.d as { predictionEnabled?: unknown };
        return { predictionEnabled: d.predictionEnabled !== false };
      } catch {
        return DEFAULT_CYCLE_SETTINGS;
      }
    },
    saveSettings: async (settings) => {
      const envelope: Envelope = {
        v: CYCLE_SETTINGS_VERSION,
        d: settings,
        ...(clock !== undefined ? { m: clock.now() } : {}),
      };
      await storage.write(SETTINGS_KEY, JSON.stringify(envelope));
    },
    readDay: (date) => dayStore.readSlice(date, cycleDayCodec),
    writeDay: (date, slice) => dayStore.writeSlice(date, cycleDayCodec, slice),
    readLoggedDays: async (from, to) => {
      const days = await dayStore.getRange(from, to, [cycleDayCodec as SliceCodec<unknown>]);
      const out = new Map<ISODate, CycleDaySlice>();
      for (const day of days) {
        const slice = getSlice<CycleDaySlice>(day, CYCLE_NAMESPACE);
        if (slice === undefined) continue;
        if (slice.flow !== null || slice.ovulationTest !== null) out.set(day.date, slice);
      }
      return out;
    },
  };
}
