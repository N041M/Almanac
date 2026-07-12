import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, addDays } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { checkinStore } from '../state/checkin-services';
import { cycleStore } from '../state/cycle-services';
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
});

describe('insights (§8) — descriptive panels from shared day data', () => {
  it('an empty history gets one actionable line, no panels (L5)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Insights' }));
    expect(await screen.findByText(/Not much here yet/)).toBeInTheDocument();
    expect(screen.queryByText('Mood & energy')).not.toBeInTheDocument();
  });

  it('check-in + cycle history produce averages, a correlation, and energy-by-phase', async () => {
    // A full 28-day cycle followed by the current one, with daily check-ins
    // whose mood tracks energy (a clean positive relationship).
    const start = addDays(today(), -35);
    for (const offset of [0, 1, 2, 28, 29]) {
      await cycleStore.writeDay(addDays(start, offset), { flow: 'medium', ovulationTest: null });
    }
    for (let i = 0; i < 30; i++) {
      const level = (i % 5) + 1;
      await checkinStore.writeDay(addDays(start, i), {
        mood: level,
        energy: level,
        symptoms: [],
        note: '',
      });
    }

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Insights' }));

    expect(await screen.findByText('Mood & energy')).toBeInTheDocument();
    expect(screen.getByText(/Mood 3(\.0)?\/5/)).toBeInTheDocument();
    expect(
      screen.getByText('Mood and Energy tend to move together (strong).'),
    ).toBeInTheDocument();

    expect(screen.getByText('Energy by cycle phase')).toBeInTheDocument();
    expect(screen.getByText('Follicular phase')).toBeInTheDocument();
    expect(screen.getByText('Luteal phase')).toBeInTheDocument();
  });
});
