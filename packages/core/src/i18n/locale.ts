import type { Weekday } from '../time/date-math.js';
import type { MeasurementSystem } from '../units/types.js';

/**
 * Locale = text + formatting + region (design §10), not just a language code.
 * Region drives week-start, date/number formatting, and metric/imperial — these
 * are structural, not cosmetic (the calendar grid and every quantity depend on
 * them).
 */
export interface Locale {
  language: string; // e.g. "en", "cs"
  region: string; // e.g. "US", "CZ"
  weekStartsOn: Weekday;
  measurement: MeasurementSystem;
}

export const EN_US: Locale = {
  language: 'en',
  region: 'US',
  weekStartsOn: 0, // Sunday
  measurement: 'imperial',
};

export const CS_CZ: Locale = {
  language: 'cs',
  region: 'CZ',
  weekStartsOn: 1, // Monday
  measurement: 'metric',
};

/** BCP-47 tag for `Intl`, e.g. "en-US". */
export function bcp47(locale: Locale): string {
  return `${locale.language}-${locale.region}`;
}
