import type { SliceCodec } from '@almanac/core';

/**
 * The cycle module's contribution to a Day (§8): the day's menstrual flow.
 * A period *day* is any day with flow; period starts/ends derive from runs of
 * flow days — never stored, so the log can't disagree with itself. Symptoms
 * ride the check-in module's shared day data by namespace, not by import (L1).
 * Privacy: local-only by default, like every slice (L6).
 */
export type FlowLevel = 'light' | 'medium' | 'heavy';

/** An at-home LH (ovulation) test result — a measurement, unlike the estimates. */
export type OvulationTestResult = 'positive' | 'negative';

export interface CycleDaySlice {
  /** null = no flow logged — the ordinary state (L5). */
  flow: FlowLevel | null;
  /** null = no test taken — the ordinary state (L5). */
  ovulationTest: OvulationTestResult | null;
}

export const CYCLE_NAMESPACE = 'cycle';
export const CYCLE_SLICE_VERSION = 1;

const FLOW_LEVELS: ReadonlyArray<FlowLevel> = ['light', 'medium', 'heavy'];
const TEST_RESULTS: ReadonlyArray<OvulationTestResult> = ['positive', 'negative'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const cycleDayCodec: SliceCodec<CycleDaySlice> = {
  namespace: CYCLE_NAMESPACE,
  version: CYCLE_SLICE_VERSION,
  default: () => ({ flow: null, ovulationTest: null }),
  decode: (raw) => {
    if (!isRecord(raw)) throw new Error('cycle slice: not an object');
    // Unknown values read as not-logged, never an error; days stored before
    // the test field existed decode the same way (additive, L5).
    const flow = raw['flow'];
    const test = raw['ovulationTest'];
    return {
      flow: FLOW_LEVELS.includes(flow as FlowLevel) ? (flow as FlowLevel) : null,
      ovulationTest: TEST_RESULTS.includes(test as OvulationTestResult)
        ? (test as OvulationTestResult)
        : null,
    };
  },
  encode: (value) => value,
};
