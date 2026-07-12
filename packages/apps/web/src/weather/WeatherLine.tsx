import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISODate } from '@almanac/core';
import { weatherCodeKey } from '@almanac/weather';
import { useWeather } from '../state/weather';

/**
 * The day's ambient weather (§8) — one quiet line on the detail surface.
 * No location, no cache, offline: the line simply isn't there (L5).
 */
export function WeatherLine({ date }: { date: ISODate }) {
  const { t } = useTranslation('weather');
  const slice = useWeather((s) => s.slices[date]);
  const load = useWeather((s) => s.load);
  const loadDay = useWeather((s) => s.loadDay);

  useEffect(() => {
    void load().then(() => loadDay(date));
  }, [load, loadDay, date]);

  if (slice === undefined || (slice.temperatureC === null && slice.weatherCode === null)) {
    return null;
  }
  return (
    <p className="text-sm text-ink-muted">
      {slice.weatherCode !== null && <span>{t(weatherCodeKey(slice.weatherCode))}</span>}
      {slice.weatherCode !== null && slice.temperatureC !== null && <span> · </span>}
      {slice.temperatureC !== null && (
        <span>{t('degrees', { value: Math.round(slice.temperatureC) })}</span>
      )}
    </p>
  );
}
