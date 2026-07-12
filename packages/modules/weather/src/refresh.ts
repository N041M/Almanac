import type { Clock, ISODate, WeatherPort } from '@almanac/core';
import type { WeatherStore } from './store.js';

// Tuning values (§8: cache aggressively — well under the ~10k/day free tier).
export const WEATHER_REFRESH_HOURS = 6;
export const WEATHER_FORECAST_DAYS = 7;

const MS_PER_HOUR = 3_600_000;

/**
 * Refresh the cached snapshots if a location is set and the cache is stale.
 * Returns the dates written (empty = nothing to do or the fetch failed —
 * either way the existing cache stands untouched, quietly, L5). `force`
 * bypasses the throttle (a fresh location pick wants immediate weather).
 */
export async function refreshWeather(
  port: WeatherPort,
  store: WeatherStore,
  clock: Clock,
  options: { force?: boolean } = {},
): Promise<ISODate[]> {
  const settings = await store.getSettings();
  if (settings.place === null) return []; // no location: weather simply absent (§8)

  const now = clock.now();
  const fresh =
    settings.lastFetchMs !== null && now - settings.lastFetchMs < WEATHER_REFRESH_HOURS * MS_PER_HOUR;
  if (fresh && options.force !== true) return [];

  const snapshots = await port.forecast(settings.place, WEATHER_FORECAST_DAYS);
  if (snapshots === null) return []; // offline/limited: keep the cache, retry next open

  const written: ISODate[] = [];
  for (const snapshot of snapshots) {
    await store.writeDay(snapshot.date, {
      temperatureC: snapshot.temperatureC,
      weatherCode: snapshot.weatherCode,
    });
    written.push(snapshot.date);
  }
  await store.saveSettings({ ...settings, lastFetchMs: now });
  return written;
}
