import { create } from 'zustand';
import { addDays, type ISODate } from '@almanac/core';
import {
  DEFAULT_CYCLE_SETTINGS,
  type CycleDaySlice,
  type FlowLevel,
  type OvulationTestResult,
} from '@almanac/cycle';
import { quietly } from './meals-services';
import { cycleStore } from './cycle-services';
import { today } from '../clock';

/** How much history feeds the stats — a year is plenty for the averages. */
export const CYCLE_HISTORY_DAYS = 365;

const EMPTY_SLICE: CycleDaySlice = { flow: null, ovulationTest: null };

export interface CycleState {
  loaded: boolean;
  loading: boolean;
  /** Every logged day (flow or test) in the history window (absent = none, L5). */
  days: Readonly<Record<ISODate, CycleDaySlice>>;
  predictionEnabled: boolean;

  load: () => Promise<void>;
  /** null clears the day's flow. */
  setFlow: (date: ISODate, flow: FlowLevel | null) => Promise<void>;
  /** null clears the day's test result. */
  setOvulationTest: (date: ISODate, result: OvulationTestResult | null) => Promise<void>;
  setPredictionEnabled: (enabled: boolean) => Promise<void>;
}

export const useCycle = create<CycleState>((set, get) => {
  /** Merge one field into the day, keeping the other field intact. */
  async function patchDay(date: ISODate, patch: Partial<CycleDaySlice>): Promise<void> {
    const next = { ...(get().days[date] ?? EMPTY_SLICE), ...patch };
    set((s) => {
      const days = { ...s.days };
      if (next.flow === null && next.ovulationTest === null) delete days[date];
      else days[date] = next;
      return { days };
    });
    await quietly(() => cycleStore.writeDay(date, next));
  }

  return {
    loaded: false,
    loading: false,
    days: {},
    predictionEnabled: DEFAULT_CYCLE_SETTINGS.predictionEnabled,

    load: async () => {
      if (get().loaded || get().loading) return;
      set({ loading: true });
      try {
        const to = today();
        const [settings, logged] = await Promise.all([
          cycleStore.getSettings(),
          cycleStore.readLoggedDays(addDays(to, -CYCLE_HISTORY_DAYS), to),
        ]);
        const days: Record<ISODate, CycleDaySlice> = {};
        for (const [date, slice] of logged) days[date] = slice;
        set({ loaded: true, days, predictionEnabled: settings.predictionEnabled });
      } finally {
        set({ loading: false });
      }
    },

    setFlow: (date, flow) => patchDay(date, { flow }),
    setOvulationTest: (date, result) => patchDay(date, { ovulationTest: result }),

    setPredictionEnabled: async (enabled) => {
      set({ predictionEnabled: enabled });
      await quietly(() => cycleStore.saveSettings({ predictionEnabled: enabled }));
    },
  };
});
