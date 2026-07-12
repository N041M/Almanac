import { createOpenMeteoPort, createWeatherStore, type FetchJson } from '@almanac/weather';
import { dayStore, storagePort } from './persistence';
import { systemClock } from '../clock';

// Composition root for the weather module. One provider (Open-Meteo) behind
// core's WeatherPort; a second source would compose here as a fallback chain,
// never an average (correlated models — see the module's adapter note).
export const fetchJson: FetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`weather: HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
};

export const weatherPort = createOpenMeteoPort(fetchJson);
export const weatherStore = createWeatherStore(storagePort, dayStore, systemClock);
