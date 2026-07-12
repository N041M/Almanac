import { describe, expect, it } from 'vitest';
import { createDayStore, createMemoryStorage } from '@almanac/core';
import { cycleDayCodec } from './slice.js';
import {
  cycleDayInfo,
  cycleStats,
  periodsFromFlowDays,
  phaseInHistory,
  phaseOn,
  predictNextStart,
  predictionWindow,
} from './stats.js';
import { createCycleStore } from './store.js';

// Three tidy 28-day cycles starting 2026-01-01, four flow days each.
const FLOW_DAYS = [
  '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04',
  '2026-01-29', '2026-01-30', '2026-01-31', '2026-02-01',
  '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01',
];

describe('periods from flow days', () => {
  it('groups consecutive days; tolerates unsorted and duplicated input (L5)', () => {
    const shuffled = ['2026-01-03', '2026-01-01', '2026-01-02', '2026-01-01', '2026-01-10'];
    expect(periodsFromFlowDays(shuffled)).toEqual([
      { start: '2026-01-01', end: '2026-01-03' },
      { start: '2026-01-10', end: '2026-01-10' },
    ]);
  });

  it('no flow days ⇒ no periods, quietly', () => {
    expect(periodsFromFlowDays([])).toEqual([]);
  });
});

describe('cycle stats + prediction (§8: informational, degrades to no guess)', () => {
  it('derives lengths and averages from clean history', () => {
    const stats = cycleStats(FLOW_DAYS);
    expect(stats.periods).toHaveLength(3);
    expect(stats.cycleLengths).toEqual([28, 28]);
    expect(stats.avgCycleDays).toBe(28);
    expect(stats.avgPeriodDays).toBe(4);
    expect(stats.lastStart).toBe('2026-02-26');
    expect(predictNextStart(stats)).toBe('2026-03-26');
  });

  it('offers no prediction below the minimum history — logging still works (L5)', () => {
    const onePeriod = cycleStats(['2026-01-01', '2026-01-02']);
    expect(onePeriod.lastStart).toBe('2026-01-01');
    expect(predictNextStart(onePeriod)).toBeNull();

    const twoPeriods = cycleStats(['2026-01-01', '2026-01-29']);
    expect(twoPeriods.cycleLengths).toEqual([28]);
    expect(predictNextStart(twoPeriods)).toBeNull();
  });

  it('a tracking lapse is not a cycle: implausible gaps are excluded from averages', () => {
    // Two clean 28-day cycles, then a 200-day logging gap, then another start.
    const stats = cycleStats(['2026-01-01', '2026-01-29', '2026-02-26', '2026-09-14']);
    expect(stats.cycleLengths).toEqual([28, 28]);
    expect(stats.avgCycleDays).toBe(28);
    // Prediction anchors on the latest actual start, post-gap.
    expect(predictNextStart(stats)).toBe('2026-10-12');
  });
});

describe('nuance: median, irregularity, window, fertile days', () => {
  // Starts 28, 26, then 29 days apart — a normal wobble, median 28.
  const WOBBLY = ['2026-01-01', '2026-01-29', '2026-02-24', '2026-03-25'];

  it('estimates from the median of recent cycles, not the mean', () => {
    const stats = cycleStats(WOBBLY);
    expect(stats.recentLengths).toEqual([28, 26, 29]);
    expect(stats.typicalCycleDays).toBe(28);
    // 2026-03-25 + 28 — one odd cycle can't drag the estimate.
    expect(predictNextStart(stats)).toBe('2026-04-22');
  });

  it('gives an honest window (shortest…longest recent cycle), not one precise date', () => {
    expect(predictionWindow(cycleStats(WOBBLY))).toEqual({
      earliest: '2026-04-20', // +26
      latest: '2026-04-23', // +29
    });
  });

  it('suppresses every claim when recent cycles are irregular — logging stands (L5)', () => {
    // 21 and 35 days apart: spread 14 > the irregularity threshold.
    const stats = cycleStats(['2026-01-01', '2026-01-22', '2026-02-26']);
    expect(stats.irregular).toBe(true);
    expect(predictNextStart(stats)).toBeNull();
    expect(predictionWindow(stats)).toBeNull();
    expect(phaseOn('2026-03-05', stats)).toBeNull();
    // …but a logged flow day is menstrual regardless of any estimate.
    expect(phaseOn('2026-02-26', stats)).toBe('menstrual');
  });

  it('marks the fertile window around the back-counted ovulation estimate', () => {
    const stats = cycleStats(FLOW_DAYS); // next start 03-26 ⇒ ovulation 03-12
    expect(cycleDayInfo('2026-03-06', stats)?.fertile).toBe(false);
    expect(cycleDayInfo('2026-03-07', stats)?.fertile).toBe(true); // −5
    expect(cycleDayInfo('2026-03-13', stats)?.fertile).toBe(true); // +1
    expect(cycleDayInfo('2026-03-14', stats)?.fertile).toBe(false);
  });

  it('numbers the day within its cycle', () => {
    const stats = cycleStats(FLOW_DAYS);
    expect(cycleDayInfo('2026-02-26', stats)?.day).toBe(1);
    expect(cycleDayInfo('2026-03-12', stats)?.day).toBe(15);
    // A date in an older, completed cycle: logged days speak, others don't.
    expect(cycleDayInfo('2026-01-30', stats)).toEqual({
      day: 2,
      phase: 'menstrual',
      fertile: false,
    });
    expect(cycleDayInfo('2026-01-15', stats)).toBeNull();
  });
});

describe('phase estimate', () => {
  const stats = cycleStats(FLOW_DAYS);

  it('walks menstrual → follicular → ovulation → luteal across the cycle', () => {
    expect(phaseOn('2026-02-27', stats)).toBe('menstrual'); // actually logged
    expect(phaseOn('2026-03-02', stats)).toBe('follicular'); // avg period over
    expect(phaseOn('2026-03-07', stats)).toBe('follicular');
    expect(phaseOn('2026-03-12', stats)).toBe('ovulation'); // day 14 of 28
    expect(phaseOn('2026-03-20', stats)).toBe('luteal');
  });

  it('is null outside what the history can speak to — before tracking, past the expected start, or with no basis', () => {
    expect(phaseOn('2025-12-25', stats)).toBeNull();
    expect(phaseOn('2026-03-27', stats)).toBeNull(); // overdue is unknown, not luteal
    expect(phaseOn('2026-01-10', cycleStats(['2026-01-01']))).toBeNull();
  });
});

describe('measured ovulation (LH tests) — measurement outranks calendar math', () => {
  it('a positive test in the current cycle anchors ovulation and predicts start = ovulation + luteal', () => {
    // One period only — calendar math alone would refuse to guess.
    const stats = cycleStats(['2026-03-01', '2026-03-02'], ['2026-03-14']);
    expect(stats.confirmedOvulation).toBe('2026-03-15'); // LH + 1
    expect(predictNextStart(stats)).toBe('2026-03-29'); // + default luteal 14
    expect(predictionWindow(stats)).toEqual({ earliest: '2026-03-29', latest: '2026-03-29' });
  });

  it('rescues prediction for irregular cycles', () => {
    // Spread 14 ⇒ irregular ⇒ no calendar estimate…
    const flows = ['2026-01-01', '2026-01-22', '2026-02-26'];
    expect(predictNextStart(cycleStats(flows))).toBeNull();
    // …but a measured ovulation carries the claim anyway.
    const confirmed = cycleStats(flows, ['2026-03-11']);
    expect(predictNextStart(confirmed)).toBe('2026-03-26');
    expect(phaseOn('2026-03-14', confirmed)).toBe('luteal');
  });

  it('phases and the fertile window re-anchor on the measured day', () => {
    const stats = cycleStats(FLOW_DAYS, ['2026-03-09']); // ovulation 03-10, not 03-12
    expect(phaseOn('2026-03-10', stats)).toBe('ovulation');
    expect(phaseOn('2026-03-12', stats)).toBe('luteal');
    expect(cycleDayInfo('2026-03-05', stats)?.fertile).toBe(true); // −5
    expect(cycleDayInfo('2026-03-04', stats)?.fertile).toBe(false); // −6
    expect(cycleDayInfo('2026-03-11', stats)?.fertile).toBe(true); // +1
    expect(cycleDayInfo('2026-03-12', stats)?.fertile).toBe(false); // +2 (was fertile unconfirmed)
  });

  it('completed confirmed cycles teach a personal luteal length', () => {
    // Positive tests 17 days before each next start ⇒ luteal 16, not the default 14.
    const stats = cycleStats(
      ['2026-01-01', '2026-01-29', '2026-02-26'],
      ['2026-01-12', '2026-02-09', '2026-03-09'],
    );
    expect(stats.lutealLengths).toEqual([16, 16]);
    expect(stats.typicalLutealDays).toBe(16);
    // Current cycle: confirmed ovulation 03-10 + personal luteal 16.
    expect(predictNextStart(stats)).toBe('2026-03-26');
  });

  it('an implausible measured luteal length is noise, not biology (L5)', () => {
    // Test 2 days before the next start ⇒ luteal 1: excluded from learning.
    const stats = cycleStats(['2026-01-01', '2026-01-29'], ['2026-01-27']);
    expect(stats.lutealLengths).toEqual([]);
    expect(stats.typicalLutealDays).toBeNull();
  });
});

describe('phase in history (for insights: completed cycles are fact, not estimate)', () => {
  const stats = cycleStats(FLOW_DAYS);

  it('back-counts ovulation from the recorded next start', () => {
    // Cycle 2026-01-01 → 01-29: ovulation = 01-29 − 14 = 01-15.
    expect(phaseInHistory('2026-01-15', stats)).toBe('ovulation');
    expect(phaseInHistory('2026-01-10', stats)).toBe('follicular');
    expect(phaseInHistory('2026-01-20', stats)).toBe('luteal');
    expect(phaseInHistory('2026-01-02', stats)).toBe('menstrual'); // logged
  });

  it('answers null before tracking and inside a lapse; current cycle falls back to the estimate', () => {
    expect(phaseInHistory('2025-12-20', stats)).toBeNull();
    expect(phaseInHistory('2026-03-12', stats)).toBe('ovulation'); // current cycle, estimated
    // A 200-day gap between starts is a lapse — no claims inside it.
    const gappy = cycleStats(['2026-01-01', '2026-07-20']);
    expect(phaseInHistory('2026-04-01', gappy)).toBeNull();
  });
});

describe('cycle store', () => {
  it('round-trips logged days (flow and tests) and reads the range back for stats', async () => {
    const storage = createMemoryStorage();
    const store = createCycleStore(storage, createDayStore(storage));
    await store.writeDay('2026-07-01', { flow: 'medium', ovulationTest: null });
    await store.writeDay('2026-07-14', { flow: null, ovulationTest: 'positive' });
    const days = await store.readLoggedDays('2026-06-01', '2026-07-31');
    expect([...days.entries()]).toEqual([
      ['2026-07-01', { flow: 'medium', ovulationTest: null }],
      ['2026-07-14', { flow: null, ovulationTest: 'positive' }],
    ]);
  });

  it('days stored before the test field existed decode with it absent (additive)', () => {
    expect(cycleDayCodec.decode({ flow: 'light' })).toEqual({
      flow: 'light',
      ovulationTest: null,
    });
    expect(cycleDayCodec.decode({ flow: 'light', ovulationTest: 'maybe' })).toEqual({
      flow: 'light',
      ovulationTest: null,
    });
  });

  it('settings default to prediction-on and survive a corrupt payload (L5)', async () => {
    const storage = createMemoryStorage();
    const store = createCycleStore(storage, createDayStore(storage));
    expect(await store.getSettings()).toEqual({ predictionEnabled: true });
    await store.saveSettings({ predictionEnabled: false });
    expect(await store.getSettings()).toEqual({ predictionEnabled: false });
    await storage.write('cycle:settings', '{ not json');
    expect(await store.getSettings()).toEqual({ predictionEnabled: true });
  });
});
