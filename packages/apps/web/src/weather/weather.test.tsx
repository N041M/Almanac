import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US } from '@almanac/core';
import { OPEN_METEO_GEOCODING_URL } from '@almanac/weather';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useWeather } from '../state/weather';
import { today } from '../clock';
import i18n from '../i18n/config';

beforeEach(async () => {
  globalThis.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  await i18n.changeLanguage('en');
  useCalendar.setState({
    locale: EN_US,
    view: 'month',
    anchor: today(),
    selected: null,
    days: {},
    starred: {},
  });
  useWeather.setState({ loaded: false, loading: false, place: null, slices: {}, lastLookupFailed: false });
});

/** fetch stub answering the geocoder and the forecast endpoints. */
function onlineFetch() {
  return vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.startsWith(OPEN_METEO_GEOCODING_URL)
        ? { results: [{ name: 'Praha', country: 'Czechia', latitude: 50.08, longitude: 14.43 }] }
        : {
            daily: {
              time: [today()],
              weather_code: [61],
              temperature_2m_max: [14.4],
            },
          },
  }));
}

describe('weather (§8) — ambient context, aggressively cached, quietly absent', () => {
  it('no location or offline ⇒ no weather line, nothing nags (L5)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    expect(screen.queryByText(/°/)).not.toBeInTheDocument();
  });

  it('setting a city geocodes, fetches, and the day detail shows the snapshot', async () => {
    vi.stubGlobal('fetch', onlineFetch());
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.type(await screen.findByLabelText('City'), 'praha{Enter}');
    await waitFor(() =>
      expect(screen.getByLabelText('City')).toHaveAttribute('placeholder', 'Praha, Czechia'),
    );

    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    expect(await screen.findByText('Rain')).toBeInTheDocument();
    expect(screen.getByText('14°')).toBeInTheDocument();

    // Persisted: the snapshot lives on the shared day record.
    expect(globalThis.localStorage.getItem(`day:${today()}:weather`) ?? '').toContain(
      '"weatherCode":61',
    );
  });

  it('an unknown city reports quietly and changes nothing (L5)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) })),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.type(await screen.findByLabelText('City'), 'nowhereville{Enter}');
    expect(await screen.findByText('No place found by that name.')).toBeInTheDocument();
  });
});
