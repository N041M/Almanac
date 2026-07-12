/**
 * The insights module (§8): pure cross-day analytics over *neutral* inputs.
 * It imports no module — the app reads the shared day records and task state,
 * shapes them into plain pairs/groups/spans, and passes them in. That seam is
 * exactly why the unified day record exists. Every function answers null (or
 * empty) when the data can't carry a claim — thin data is a normal state, and
 * no claim beats a shaky one (L5). Descriptive statistics only: correlations
 * describe, they never diagnose.
 */

// Tuning values (exported per the constants convention).
/** Pairs needed before a correlation is worth stating. */
export const MIN_CORRELATION_SAMPLES = 8;
/** Group members needed before a group average is worth stating. */
export const MIN_GROUP_SAMPLES = 3;
/** |r| below this reads as "no relationship" and is not reported. */
export const MIN_REPORTABLE_R = 0.25;

export interface Pair {
  x: number;
  y: number;
}

export interface Correlation {
  /** Pearson r, −1…1. */
  r: number;
  n: number;
  strength: 'weak' | 'moderate' | 'strong';
}

/**
 * Pearson correlation, gated: fewer than MIN_CORRELATION_SAMPLES pairs, zero
 * variance on either side, or |r| under the reportable floor ⇒ null.
 */
export function correlate(pairs: ReadonlyArray<Pair>): Correlation | null {
  const n = pairs.length;
  if (n < MIN_CORRELATION_SAMPLES) return null;
  const meanX = pairs.reduce((a, p) => a + p.x, 0) / n;
  const meanY = pairs.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const { x, y } of pairs) {
    sxx += (x - meanX) ** 2;
    syy += (y - meanY) ** 2;
    sxy += (x - meanX) * (y - meanY);
  }
  if (sxx === 0 || syy === 0) return null; // a constant has no relationships
  const r = sxy / Math.sqrt(sxx * syy);
  if (Math.abs(r) < MIN_REPORTABLE_R) return null;
  const strength = Math.abs(r) < 0.5 ? 'weak' : Math.abs(r) < 0.75 ? 'moderate' : 'strong';
  return { r, n, strength };
}

export interface GroupAverage {
  group: string;
  mean: number;
  n: number;
}

/**
 * Mean per group, in descending-mean order; groups under MIN_GROUP_SAMPLES
 * are dropped (one odd day is an anecdote, not an average).
 */
export function averageByGroup(
  entries: ReadonlyArray<{ group: string; value: number }>,
): GroupAverage[] {
  const sums = new Map<string, { total: number; n: number }>();
  for (const { group, value } of entries) {
    const bucket = sums.get(group) ?? { total: 0, n: 0 };
    bucket.total += value;
    bucket.n += 1;
    sums.set(group, bucket);
  }
  return [...sums.entries()]
    .filter(([, { n }]) => n >= MIN_GROUP_SAMPLES)
    .map(([group, { total, n }]) => ({ group, mean: total / n, n }))
    .sort((a, b) => b.mean - a.mean);
}

export interface Allocation {
  key: string;
  minutes: number;
}

/** Total minutes per key, descending; zero/negative spans contribute nothing (L5). */
export function allocateMinutes(
  spans: ReadonlyArray<{ key: string; minutes: number }>,
): Allocation[] {
  const totals = new Map<string, number>();
  for (const { key, minutes } of spans) {
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    totals.set(key, (totals.get(key) ?? 0) + minutes);
  }
  return [...totals.entries()]
    .map(([key, minutes]) => ({ key, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}
