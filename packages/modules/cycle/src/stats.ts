import { addDays, diffDays, type ISODate } from '@almanac/core';

/** One period: a maximal run of consecutive flow days. */
export interface Period {
  start: ISODate;
  end: ISODate;
}

// Tuning values (§8, exported per the constants convention).
/** Completed cycles needed before any prediction is offered. */
export const MIN_CYCLES_FOR_PREDICTION = 2;
/** A start-to-start gap beyond this is a tracking lapse, not a cycle. */
export const MAX_PLAUSIBLE_CYCLE_DAYS = 90;
/** Only the most recent cycles feed the estimate — bodies change. */
export const RECENT_CYCLES_WINDOW = 6;
/**
 * Recent cycles varying by more than this (max − min) read as irregular:
 * phase and next-start claims are suppressed — an honest "don't know" beats a
 * falsely precise guess. History and logging are untouched (L5).
 */
export const IRREGULAR_SPREAD_DAYS = 9;
/**
 * The luteal phase is comparatively stable across people and cycles, so
 * ovulation is estimated by counting *back* from the predicted next start —
 * markedly better than counting forward when follicular length wobbles.
 */
export const LUTEAL_PHASE_DAYS = 14;
/** How far around the ovulation estimate still reads as "around ovulation". */
export const OVULATION_WINDOW_DAYS = 1;
/** The fertile window: sperm viability before ovulation, the ovum's day after. */
export const FERTILE_WINDOW_BEFORE_DAYS = 5;
export const FERTILE_WINDOW_AFTER_DAYS = 1;
/** The LH surge precedes ovulation by roughly a day. */
export const OVULATION_AFTER_LH_DAYS = 1;
/** Confirmed-cycle luteal lengths outside this range are noise, not biology. */
export const MIN_PLAUSIBLE_LUTEAL_DAYS = 7;
export const MAX_PLAUSIBLE_LUTEAL_DAYS = 20;

export interface CycleStats {
  periods: Period[];
  /** Completed start-to-start lengths, implausible gaps excluded. */
  cycleLengths: number[];
  /** The lengths the estimate actually uses (last RECENT_CYCLES_WINDOW). */
  recentLengths: number[];
  /** All-time mean — history context, never the predictor. */
  avgCycleDays: number | null;
  /** Median of the recent lengths — robust to one odd cycle. */
  typicalCycleDays: number | null;
  /** max − min of the recent lengths; beyond IRREGULAR_SPREAD_DAYS ⇒ irregular. */
  spreadDays: number | null;
  irregular: boolean;
  avgPeriodDays: number | null;
  lastStart: ISODate | null;
  /**
   * The current cycle's *measured* ovulation (latest positive LH test on/after
   * the last start, plus OVULATION_AFTER_LH_DAYS) — when present it outranks
   * every calendar estimate, and prediction works even for irregular cycles.
   */
  confirmedOvulation: ISODate | null;
  /** Luteal lengths from completed cycles with a positive test (measured). */
  lutealLengths: number[];
  /** Median measured luteal length — personalizes the LUTEAL_PHASE_DAYS default. */
  typicalLutealDays: number | null;
}

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

/** Everything the UI can say about one date, all of it a personal estimate. */
export interface CycleDayInfo {
  /** 1-based day within its cycle (from the last start on/before the date). */
  day: number;
  phase: CyclePhase | null;
  /** Inside the estimated fertile window (ovulation −5…+1 days). */
  fertile: boolean;
}

/** Group logged flow days into periods. Unsorted/duplicate input is fine (L5). */
export function periodsFromFlowDays(flowDays: ReadonlyArray<ISODate>): Period[] {
  const sorted = [...new Set(flowDays)].sort();
  const periods: Period[] = [];
  for (const date of sorted) {
    const current = periods[periods.length - 1];
    if (current !== undefined && diffDays(current.end, date) === 1) current.end = date;
    else periods.push({ start: date, end: date });
  }
  return periods;
}

const mean = (xs: number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid];
  const lo = sorted[mid - 1];
  if (hi === undefined) return null;
  return sorted.length % 2 === 1 ? hi : lo === undefined ? hi : (lo + hi) / 2;
};

/**
 * Derive everything the UI and prediction need from the raw flow days plus
 * any positive ovulation-test days. Tests are optional throughout — absent,
 * everything behaves exactly as pure calendar math (L5).
 */
export function cycleStats(
  flowDays: ReadonlyArray<ISODate>,
  positiveTestDays: ReadonlyArray<ISODate> = [],
): CycleStats {
  const periods = periodsFromFlowDays(flowDays);
  const tests = [...new Set(positiveTestDays)].sort();
  const cycleLengths: number[] = [];
  for (let i = 1; i < periods.length; i++) {
    const prev = periods[i - 1];
    const next = periods[i];
    if (prev === undefined || next === undefined) continue;
    const length = diffDays(prev.start, next.start);
    // A lapse in tracking is not a 90-day cycle — exclude it, keep the rest (L5).
    if (length <= MAX_PLAUSIBLE_CYCLE_DAYS) cycleLengths.push(length);
  }
  const recentLengths = cycleLengths.slice(-RECENT_CYCLES_WINDOW);
  const spreadDays =
    recentLengths.length === 0 ? null : Math.max(...recentLengths) - Math.min(...recentLengths);
  const lastPeriod = periods[periods.length - 1];

  // Measured luteal lengths: in each completed cycle, the latest positive
  // test → the next start. Implausible values are noise and cost only
  // themselves (L5).
  const lutealLengths: number[] = [];
  for (let i = 1; i < periods.length; i++) {
    const prevStart = periods[i - 1]?.start;
    const nextStart = periods[i]?.start;
    if (prevStart === undefined || nextStart === undefined) continue;
    const test = [...tests].reverse().find((d) => d >= prevStart && d < nextStart);
    if (test === undefined) continue;
    const luteal = diffDays(addDays(test, OVULATION_AFTER_LH_DAYS), nextStart);
    if (luteal >= MIN_PLAUSIBLE_LUTEAL_DAYS && luteal <= MAX_PLAUSIBLE_LUTEAL_DAYS) {
      lutealLengths.push(luteal);
    }
  }

  // The current cycle's measured ovulation, if a test confirmed one.
  const lastStart = lastPeriod?.start ?? null;
  const currentTest =
    lastStart === null ? undefined : [...tests].reverse().find((d) => d >= lastStart);
  return {
    periods,
    cycleLengths,
    recentLengths,
    avgCycleDays: mean(cycleLengths),
    typicalCycleDays: median(recentLengths),
    spreadDays,
    irregular: spreadDays !== null && spreadDays > IRREGULAR_SPREAD_DAYS,
    avgPeriodDays: mean(periods.map((p) => diffDays(p.start, p.end) + 1)),
    lastStart,
    confirmedOvulation:
      currentTest === undefined ? null : addDays(currentTest, OVULATION_AFTER_LH_DAYS),
    lutealLengths,
    typicalLutealDays: median(lutealLengths),
  };
}

/**
 * The next period's estimated start, or null when the history can't carry a
 * claim: fewer than MIN_CYCLES_FOR_PREDICTION completed cycles, or recent
 * cycles too irregular. No guess is a normal, quiet state — logging never
 * depends on it (L5). A personal estimate, informational only (§8).
 */
export function predictNextStart(stats: CycleStats): ISODate | null {
  // A measured ovulation outranks calendar math entirely: ovulation plus the
  // (personal, else default) luteal length — no cycle-history gates apply,
  // which is exactly what rescues irregular cycles.
  if (stats.confirmedOvulation !== null) {
    return addDays(
      stats.confirmedOvulation,
      Math.round(stats.typicalLutealDays ?? LUTEAL_PHASE_DAYS),
    );
  }
  if (stats.lastStart === null || stats.typicalCycleDays === null) return null;
  if (stats.recentLengths.length < MIN_CYCLES_FOR_PREDICTION || stats.irregular) return null;
  return addDays(stats.lastStart, Math.round(stats.typicalCycleDays));
}

/**
 * The plausible range for the next start — the recent shortest to the recent
 * longest cycle — so a wobbly history yields an honest window, not one
 * falsely precise date. Null exactly when `predictNextStart` is.
 */
export function predictionWindow(stats: CycleStats): { earliest: ISODate; latest: ISODate } | null {
  const predicted = predictNextStart(stats);
  if (predicted === null || stats.lastStart === null) return null;
  // A measured ovulation collapses the window: the luteal phase barely varies.
  if (stats.confirmedOvulation !== null) return { earliest: predicted, latest: predicted };
  if (stats.recentLengths.length === 0) return null;
  return {
    earliest: addDays(stats.lastStart, Math.min(...stats.recentLengths)),
    latest: addDays(stats.lastStart, Math.max(...stats.recentLengths)),
  };
}

/**
 * What the history can say about one date: its day-in-cycle, the estimated
 * phase, and whether it falls in the fertile window. Ovulation anchors on the
 * predicted next start minus the luteal constant. Null answers whenever the
 * honest answer is a shrug: no start on record before the date, a date at or
 * past the earliest plausible next start (overdue is unknown, not luteal), or
 * an irregular/thin history — except that an actually-logged flow day is
 * always menstrual, estimate or no estimate.
 */
export function cycleDayInfo(date: ISODate, stats: CycleStats): CycleDayInfo | null {
  // The cycle this date lives in: the last period starting on/before it.
  const anchor = [...stats.periods].reverse().find((p) => p.start <= date);
  if (anchor === undefined) return null;
  const day = diffDays(anchor.start, date) + 1;
  const logged = stats.periods.some((p) => date >= p.start && date <= p.end);

  const nextStart = predictNextStart(stats);
  // Estimates only apply inside the current (last) cycle.
  if (nextStart === null || anchor.start !== stats.lastStart) {
    return logged ? { day, phase: 'menstrual', fertile: false } : null;
  }

  const window = predictionWindow(stats);
  const earliestNext = window?.earliest ?? nextStart;
  // Measured ovulation wins; otherwise back-count the luteal length from the
  // predicted next start (personal median when confirmed cycles taught us one).
  const ovulation =
    stats.confirmedOvulation ??
    addDays(nextStart, -Math.round(stats.typicalLutealDays ?? LUTEAL_PHASE_DAYS));
  const fertile =
    date >= addDays(ovulation, -FERTILE_WINDOW_BEFORE_DAYS) &&
    date <= addDays(ovulation, FERTILE_WINDOW_AFTER_DAYS);

  if (logged) return { day, phase: 'menstrual', fertile };
  // At or past the earliest plausible next start, the phase is unknown.
  if (date >= earliestNext) return { day, phase: null, fertile: false };
  let phase: CyclePhase;
  if (day <= Math.round(stats.avgPeriodDays ?? 0)) phase = 'menstrual';
  else if (Math.abs(diffDays(ovulation, date)) <= OVULATION_WINDOW_DAYS) phase = 'ovulation';
  else phase = date < ovulation ? 'follicular' : 'luteal';
  return { day, phase, fertile };
}

/** The phase alone — a thin view over `cycleDayInfo`. */
export function phaseOn(date: ISODate, stats: CycleStats): CyclePhase | null {
  return cycleDayInfo(date, stats)?.phase ?? null;
}

/**
 * The phase of a date inside a *completed* cycle — for history/insights.
 * Unlike the forward estimate, the next start is recorded fact here, so
 * ovulation back-counts from it directly (personal luteal median when known).
 * Dates in the current, open cycle fall back to the forward estimate; dates
 * before tracking answer null (L5).
 */
export function phaseInHistory(date: ISODate, stats: CycleStats): CyclePhase | null {
  if (stats.periods.some((p) => date >= p.start && date <= p.end)) return 'menstrual';
  const luteal = Math.round(stats.typicalLutealDays ?? LUTEAL_PHASE_DAYS);
  for (let i = 1; i < stats.periods.length; i++) {
    const start = stats.periods[i - 1]?.start;
    const nextStart = stats.periods[i]?.start;
    if (start === undefined || nextStart === undefined) continue;
    if (date < start || date >= nextStart) continue;
    // A tracking lapse is not a cycle — no phase claims inside it (L5).
    if (diffDays(start, nextStart) > MAX_PLAUSIBLE_CYCLE_DAYS) return null;
    const ovulation = addDays(nextStart, -luteal);
    if (Math.abs(diffDays(ovulation, date)) <= OVULATION_WINDOW_DAYS) return 'ovulation';
    return date < ovulation ? 'follicular' : 'luteal';
  }
  return cycleDayInfo(date, stats)?.phase ?? null;
}
