import { describe, expect, it, vi } from 'vitest';
import { createDayStore, createFixedClock, createMemoryStorage } from '@almanac/core';
import { createOpenMeteoPort, geocodeCity } from './open-meteo.js';
import { weatherCodeKey, weatherDayCodec } from './slice.js';
import { createWeatherStore } from './store.js';
import { refreshWeather, WEATHER_REFRESH_HOURS } from './refresh.js';

const PRAGUE = { latitude: 50.08, longitude: 14.43, label: 'Praha, Czechia' };

const FORECAST_PAYLOAD = {
  daily: {
    time: ['2026-07-11', '2026-07-12', 'garbage-kept-out'],
    weather_code: [61, 3, 'x'],
    temperature_2m_max: [14.2, 22.7, 30],
  },
};

function makeWorld(payload: unknown = FORECAST_PAYLOAD) {
  const storage = createMemoryStorage();
  const store = createWeatherStore(storage, createDayStore(storage));
  const fetchJson = vi.fn(async () => payload);
  const port = createOpenMeteoPort(fetchJson);
  return { storage, store, port, fetchJson };
}

describe('Open-Meteo adapter (one provider behind the port; failures ⇒ null, L5)', () => {
  it('parses a daily forecast; a malformed day costs only itself', async () => {
    const { port } = makeWorld();
    const days = await port.forecast(PRAGUE, 7);
    expect(days).toEqual([
      { date: '2026-07-11', weatherCode: 61, temperatureC: 14.2 },
      { date: '2026-07-12', weatherCode: 3, temperatureC: 22.7 },
    ]);
  });

  it('offline or a garbage payload reads as null, never a throw', async () => {
    const offline = createOpenMeteoPort(async () => {
      throw new Error('offline');
    });
    expect(await offline.forecast(PRAGUE, 7)).toBeNull();
    const garbage = createOpenMeteoPort(async () => 'not json we expected');
    expect(await garbage.current(PRAGUE)).toBeNull();
  });

  it('geocodes a city and degrades to null on no hit', async () => {
    const found = await geocodeCity(
      async () => ({ results: [{ name: 'Praha', country: 'Czechia', latitude: 50.08, longitude: 14.43 }] }),
      'praha',
    );
    expect(found).toEqual(PRAGUE);
    expect(await geocodeCity(async () => ({ results: [] }), 'nowhereville')).toBeNull();
    expect(await geocodeCity(async () => ({}), '')).toBeNull();
  });
});

describe('refresh — aggressive caching (§8)', () => {
  it('does nothing without a location (weather simply absent)', async () => {
    const { store, port, fetchJson } = makeWorld();
    expect(await refreshWeather(port, store, createFixedClock(0))).toEqual([]);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('fetches once, then throttles until the cache is stale; force bypasses', async () => {
    const { store, port, fetchJson } = makeWorld();
    await store.saveSettings({ place: PRAGUE, lastFetchMs: null });

    const t0 = 1_000_000;
    const written = await refreshWeather(port, store, createFixedClock(t0));
    expect(written).toEqual(['2026-07-11', '2026-07-12']);
    expect(await store.readDay('2026-07-11')).toEqual({ temperatureC: 14.2, weatherCode: 61 });

    // Within the window: the cache stands, no second call.
    const soon = t0 + (WEATHER_REFRESH_HOURS - 1) * 3_600_000;
    expect(await refreshWeather(port, store, createFixedClock(soon))).toEqual([]);
    expect(fetchJson).toHaveBeenCalledTimes(1);

    // …unless forced (a fresh location pick wants weather now).
    expect(await refreshWeather(port, store, createFixedClock(soon), { force: true })).toHaveLength(2);

    // Past the window (measured from the forced fetch) it refreshes on its own.
    const later = soon + (WEATHER_REFRESH_HOURS + 1) * 3_600_000;
    expect(await refreshWeather(port, store, createFixedClock(later))).toHaveLength(2);
  });

  it('a failed fetch keeps the cache and the old fetch time (retry next open)', async () => {
    const { store } = makeWorld();
    await store.saveSettings({ place: PRAGUE, lastFetchMs: null });
    const dead = createOpenMeteoPort(async () => {
      throw new Error('offline');
    });
    expect(await refreshWeather(dead, store, createFixedClock(5))).toEqual([]);
    expect((await store.getSettings()).lastFetchMs).toBeNull();
  });
});

describe('slice + labels', () => {
  it('decodes defensively', () => {
    expect(weatherDayCodec.decode({ temperatureC: 21.5, weatherCode: 61 })).toEqual({
      temperatureC: 21.5,
      weatherCode: 61,
    });
    expect(weatherDayCodec.decode({ temperatureC: 'warm' })).toEqual({
      temperatureC: null,
      weatherCode: null,
    });
  });

  it('maps WMO codes to label groups, unknown included', () => {
    expect(weatherCodeKey(0)).toBe('wmo_clear');
    expect(weatherCodeKey(2)).toBe('wmo_partly');
    expect(weatherCodeKey(48)).toBe('wmo_fog');
    expect(weatherCodeKey(55)).toBe('wmo_drizzle');
    expect(weatherCodeKey(63)).toBe('wmo_rain');
    expect(weatherCodeKey(75)).toBe('wmo_snow');
    expect(weatherCodeKey(81)).toBe('wmo_showers');
    expect(weatherCodeKey(86)).toBe('wmo_snow');
    expect(weatherCodeKey(96)).toBe('wmo_storm');
    expect(weatherCodeKey(42)).toBe('wmo_unknown');
  });
});
