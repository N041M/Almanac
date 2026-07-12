import { create } from 'zustand';
import type { ISODate } from '@almanac/core';
import {
  WEATHER_NAMESPACE,
  geocodeCity,
  refreshWeather,
  type GeocodedPlace,
  type WeatherDaySlice,
} from '@almanac/weather';
import { quietly } from './meals-services';
import { fetchJson, weatherPort, weatherStore } from './weather-services';
import { signals } from './signals';
import { useCalendar } from './store';
import { systemClock, today } from '../clock';

export interface WeatherState {
  loaded: boolean;
  loading: boolean;
  /** null = no location chosen — weather simply absent everywhere (§8). */
  place: GeocodedPlace | null;
  /** Read-through cache of day snapshots. */
  slices: Readonly<Record<ISODate, WeatherDaySlice>>;
  /** True after a city lookup found nothing (cleared on the next try). */
  lastLookupFailed: boolean;

  load: () => Promise<void>;
  loadDay: (date: ISODate) => Promise<void>;
  /** Geocode a city, save it, and fetch immediately. Returns success. */
  setCity: (query: string) => Promise<boolean>;
}

export const useWeather = create<WeatherState>((set, get) => {
  async function pullDays(dates: ISODate[]): Promise<void> {
    for (const date of dates) {
      const slice = await weatherStore.readDay(date);
      set((s) => ({ slices: { ...s.slices, [date]: slice } }));
    }
    if (dates.length > 0) void useCalendar.getState().invalidateDays();
  }

  return {
    loaded: false,
    loading: false,
    place: null,
    slices: {},
    lastLookupFailed: false,

    load: async () => {
      if (get().loaded || get().loading) return;
      set({ loading: true });
      try {
        const settings = await weatherStore.getSettings();
        set({ loaded: true, place: settings.place });
        // Today's snapshot as an abstract signal — consumers (e.g. the meal
        // engine) read it without importing this module (§8, L1).
        signals.register<WeatherDaySlice | undefined>(WEATHER_NAMESPACE, () => {
          const snapshot = get().slices[today()];
          return snapshot !== undefined &&
            (snapshot.temperatureC !== null || snapshot.weatherCode !== null)
            ? snapshot
            : undefined;
        });
        const written = await refreshWeather(weatherPort, weatherStore, systemClock);
        await pullDays(written);
      } finally {
        set({ loading: false });
      }
    },

    loadDay: async (date) => {
      if (date in get().slices) return;
      const slice = await weatherStore.readDay(date);
      set((s) => ({ slices: { ...s.slices, [date]: slice } }));
    },

    setCity: async (query) => {
      const place = await geocodeCity(fetchJson, query);
      if (place === null) {
        set({ lastLookupFailed: true });
        return false; // not found/offline: nothing changes, quietly (L5)
      }
      set({ place, lastLookupFailed: false, slices: {} });
      const settings = await weatherStore.getSettings();
      await quietly(() => weatherStore.saveSettings({ ...settings, place }));
      const written = await refreshWeather(weatherPort, weatherStore, systemClock, {
        force: true,
      });
      await pullDays(written);
      return true;
    },
  };
});
