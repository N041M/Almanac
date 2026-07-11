import type { ModuleManifest, SliceCodec } from '@almanac/core';
import { CYCLE_NAMESPACE, cycleDayCodec } from './slice.js';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The cycle module's manifest: its day-slice codec (per-day flow) and its
 * i18n namespace. Periods, stats, and predictions all derive from the flow
 * days — the slice is the only stored truth (§8).
 */
export const cycleManifest: ModuleManifest = {
  id: CYCLE_NAMESPACE,
  codecs: [cycleDayCodec as SliceCodec<unknown>],
  messages: { en, cs },
};
