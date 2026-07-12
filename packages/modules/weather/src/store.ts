import type { Clock, DayStore, ISODate, StoragePort } from '@almanac/core';
import { weatherDayCodec, type WeatherDaySlice } from './slice.js';
import type { GeocodedPlace } from './open-meteo.js';

// The module's own (non-day) state: the chosen place + last fetch time under
// one key, a versioned envelope like every slice (§11). Reads never throw —
// corrupt payloads degrade to "no location" in isolation (L5).

const SETTINGS_KEY = 'weather:settings';
export const WEATHER_SETTINGS_VERSION = 1;

export interface WeatherSettings {
  /** null = no location chosen — weather is simply absent (§8 degrade). */
  place: GeocodedPlace | null;
  /** Epoch ms of the last successful refresh; throttles the API (§8: cache aggressively). */
  lastFetchMs: number | null;
}

export const DEFAULT_WEATHER_SETTINGS: WeatherSettings = { place: null, lastFetchMs: null };

interface Envelope {
  v: number;
  d: unknown;
  m?: number;
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'v' in value && 'd' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function decodeSettings(value: unknown): WeatherSettings {
  if (!isRecord(value)) return DEFAULT_WEATHER_SETTINGS;
  const place = value['place'];
  const lastFetchMs = value['lastFetchMs'];
  let decoded: GeocodedPlace | null = null;
  if (
    isRecord(place) &&
    typeof place['latitude'] === 'number' &&
    Number.isFinite(place['latitude']) &&
    typeof place['longitude'] === 'number' &&
    Number.isFinite(place['longitude'])
  ) {
    decoded = {
      latitude: place['latitude'],
      longitude: place['longitude'],
      label: typeof place['label'] === 'string' ? place['label'] : '',
    };
  }
  return {
    place: decoded,
    lastFetchMs:
      typeof lastFetchMs === 'number' && Number.isFinite(lastFetchMs) ? lastFetchMs : null,
  };
}

/** The weather module's persistence: settings + per-day cached snapshots. */
export interface WeatherStore {
  getSettings(): Promise<WeatherSettings>;
  saveSettings(settings: WeatherSettings): Promise<void>;
  readDay(date: ISODate): Promise<WeatherDaySlice>;
  writeDay(date: ISODate, slice: WeatherDaySlice): Promise<void>;
}

export function createWeatherStore(
  storage: StoragePort,
  dayStore: DayStore,
  clock?: Clock,
): WeatherStore {
  return {
    getSettings: async () => {
      let raw: string | null;
      try {
        raw = await storage.read(SETTINGS_KEY);
      } catch {
        return DEFAULT_WEATHER_SETTINGS;
      }
      if (raw === null) return DEFAULT_WEATHER_SETTINGS;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isEnvelope(parsed) || parsed.v !== WEATHER_SETTINGS_VERSION) {
          return DEFAULT_WEATHER_SETTINGS;
        }
        return decodeSettings(parsed.d);
      } catch {
        return DEFAULT_WEATHER_SETTINGS;
      }
    },
    saveSettings: async (settings) => {
      const envelope: Envelope = {
        v: WEATHER_SETTINGS_VERSION,
        d: settings,
        ...(clock !== undefined ? { m: clock.now() } : {}),
      };
      await storage.write(SETTINGS_KEY, JSON.stringify(envelope));
    },
    readDay: (date) => dayStore.readSlice(date, weatherDayCodec),
    writeDay: (date, slice) => dayStore.writeSlice(date, weatherDayCodec, slice),
  };
}
