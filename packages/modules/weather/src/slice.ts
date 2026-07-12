import type { SliceCodec } from '@almanac/core';

/**
 * The weather module's contribution to a Day (§8): the cached ambient
 * snapshot — daily max temperature + WMO code. Written by the refresh, read
 * by the UI and (through the signal registry) by consumers that never import
 * this module. An absent/blank snapshot is a day without weather — the
 * ordinary offline state (L5).
 */
export interface WeatherDaySlice {
  temperatureC: number | null;
  weatherCode: number | null;
}

export const WEATHER_NAMESPACE = 'weather';
export const WEATHER_SLICE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export const weatherDayCodec: SliceCodec<WeatherDaySlice> = {
  namespace: WEATHER_NAMESPACE,
  version: WEATHER_SLICE_VERSION,
  default: () => ({ temperatureC: null, weatherCode: null }),
  decode: (raw) => {
    if (!isRecord(raw)) throw new Error('weather slice: not an object');
    return {
      temperatureC: finiteOrNull(raw['temperatureC']),
      weatherCode: finiteOrNull(raw['weatherCode']),
    };
  },
  encode: (value) => value,
};

/**
 * WMO weather code → the i18n label key for its group. Unknown codes get the
 * generic key, never a blank (L5).
 */
export function weatherCodeKey(code: number): string {
  if (code === 0) return 'wmo_clear';
  if (code >= 1 && code <= 3) return 'wmo_partly';
  if (code === 45 || code === 48) return 'wmo_fog';
  if (code >= 51 && code <= 57) return 'wmo_drizzle';
  if (code >= 61 && code <= 67) return 'wmo_rain';
  if (code >= 71 && code <= 77) return 'wmo_snow';
  if (code >= 80 && code <= 82) return 'wmo_showers';
  if (code === 85 || code === 86) return 'wmo_snow';
  if (code >= 95) return 'wmo_storm';
  return 'wmo_unknown';
}
