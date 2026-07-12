import type { GeoCoordinates, WeatherPort, WeatherSnapshot } from '@almanac/core';

/**
 * The Open-Meteo adapter behind core's `WeatherPort` (§8: no key, no signup,
 * CC BY 4.0 attribution, ~10k calls/day — cache aggressively). The HTTP seam
 * is injected per L3/L4 — no global `fetch` in module logic. Every failure
 * path returns `null`: the caller keeps its cache and the day simply has no
 * fresh weather (L5).
 *
 * Multi-source posture (decided 2026-07-11): one provider. If a second source
 * ever arrives it composes behind this same port as a *fallback chain*, not an
 * average — resellers share the underlying models, so averaging correlated
 * data buys little; Open-Meteo's own ensemble endpoint is the honest source of
 * spread/confidence if we ever want it.
 */
export type FetchJson = (url: string) => Promise<unknown>;

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/** A geocoded place — the "manual city" degradation path's result (§8). */
export interface GeocodedPlace extends GeoCoordinates {
  /** Display label, e.g. "Praha, Czechia". */
  label: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function createOpenMeteoPort(fetchJson: FetchJson): WeatherPort {
  async function daily(at: GeoCoordinates, days: number): Promise<WeatherSnapshot[] | null> {
    try {
      const url =
        `${OPEN_METEO_FORECAST_URL}?latitude=${at.latitude}&longitude=${at.longitude}` +
        `&daily=weather_code,temperature_2m_max&forecast_days=${days}&timezone=UTC`;
      const payload = await fetchJson(url);
      if (!isRecord(payload) || !isRecord(payload['daily'])) return null;
      const dates = payload['daily']['time'];
      const codes = payload['daily']['weather_code'];
      const temps = payload['daily']['temperature_2m_max'];
      if (!Array.isArray(dates) || !Array.isArray(codes) || !Array.isArray(temps)) return null;
      const out: WeatherSnapshot[] = [];
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const weatherCode = finite(codes[i]);
        const temperatureC = finite(temps[i]);
        // A malformed day costs only itself (L5).
        if (typeof date !== 'string' || weatherCode === null || temperatureC === null) continue;
        out.push({ date, weatherCode, temperatureC });
      }
      return out;
    } catch {
      return null; // offline/limited: the caller's cache stands (L5)
    }
  }

  return {
    current: async (at) => {
      const today = await daily(at, 1);
      return today?.[0] ?? null;
    },
    forecast: (at, days) => daily(at, days),
  };
}

/** City name → coordinates via Open-Meteo's geocoder; null = not found/offline (L5). */
export async function geocodeCity(
  fetchJson: FetchJson,
  query: string,
): Promise<GeocodedPlace | null> {
  const trimmed = query.trim();
  if (trimmed === '') return null;
  try {
    const url = `${OPEN_METEO_GEOCODING_URL}?name=${encodeURIComponent(trimmed)}&count=1`;
    const payload = await fetchJson(url);
    if (!isRecord(payload) || !Array.isArray(payload['results'])) return null;
    const hit = payload['results'][0];
    if (!isRecord(hit)) return null;
    const latitude = finite(hit['latitude']);
    const longitude = finite(hit['longitude']);
    if (latitude === null || longitude === null || typeof hit['name'] !== 'string') return null;
    const country = typeof hit['country'] === 'string' ? `, ${hit['country']}` : '';
    return { latitude, longitude, label: `${hit['name']}${country}` };
  } catch {
    return null;
  }
}
