import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, addDays } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useCycle } from '../state/cycle';
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
  useCycle.setState({ loaded: false, loading: false, days: {}, predictionEnabled: true });
});

async function openToday(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('gridcell', { current: 'date' }));
  return within(await screen.findByRole('region', { name: 'Cycle' }));
}

describe('cycle tracking (§8) — flow log + informational prediction', () => {
  it('logs and clears the day flow; the day slice persists it', async () => {
    const user = userEvent.setup();
    const section = await openToday(user);

    await user.click(section.getByRole('button', { name: 'Set flow to Medium' }));
    expect(globalThis.localStorage.getItem(`day:${today()}:cycle`) ?? '').toContain(
      '"flow":"medium"',
    );

    await user.click(section.getByRole('button', { name: 'Clear flow' }));
    expect(section.getByRole('button', { name: 'Set flow to Medium' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(globalThis.localStorage.getItem(`day:${today()}:cycle`) ?? '').toContain('"flow":null');
  });

  it('with two completed cycles the estimate appears; switching predictions off leaves logging alone', async () => {
    // Two prior starts, 28 days apart; logging today makes cycles [28, 28].
    await cycleStore.writeDay(addDays(today(), -56), { flow: 'medium', ovulationTest: null });
    await cycleStore.writeDay(addDays(today(), -28), { flow: 'medium', ovulationTest: null });

    const user = userEvent.setup();
    const section = await openToday(user);
    await user.click(section.getByRole('button', { name: 'Set flow to Light' }));

    expect(await section.findByText(/Next period around/)).toBeInTheDocument();
    expect(section.getByText('Menstrual phase')).toBeInTheDocument();
    expect(section.getByText('Average cycle 28 days')).toBeInTheDocument();
    expect(section.getByText(/informational only/)).toBeInTheDocument();

    await useCycle.getState().setPredictionEnabled(false);
    await waitFor(() =>
      expect(section.queryByText(/Next period around/)).not.toBeInTheDocument(),
    );
    // Logging is untouched by the switch (L5).
    expect(section.getByRole('button', { name: 'Clear flow' })).toBeInTheDocument();
  });

  it('a wobbly-but-regular history yields an honest window and the day number', async () => {
    // Cycles of 26 and 29 days — normal wobble, still predictable.
    await cycleStore.writeDay(addDays(today(), -55), { flow: 'medium', ovulationTest: null });
    await cycleStore.writeDay(addDays(today(), -29), { flow: 'medium', ovulationTest: null });

    const user = userEvent.setup();
    const section = await openToday(user);
    await user.click(section.getByRole('button', { name: 'Set flow to Light' }));

    expect(await section.findByText(/Next period between/)).toBeInTheDocument();
    expect(section.getByText('Day 1')).toBeInTheDocument();
  });

  it('irregular recent cycles get the no-estimate note instead of a guess (L5)', async () => {
    // Cycles of 21 and 35 days — spread beyond the irregularity threshold.
    await cycleStore.writeDay(addDays(today(), -56), { flow: 'medium', ovulationTest: null });
    await cycleStore.writeDay(addDays(today(), -35), { flow: 'medium', ovulationTest: null });

    const user = userEvent.setup();
    const section = await openToday(user);
    await user.click(section.getByRole('button', { name: 'Set flow to Medium' }));

    expect(await section.findByText(/vary too much/)).toBeInTheDocument();
    expect(section.queryByText(/Next period/)).not.toBeInTheDocument();
  });

  it('a positive LH test anchors the estimate even when history alone could not carry one', async () => {
    // One period two weeks ago — calendar math alone refuses to guess.
    await cycleStore.writeDay(addDays(today(), -14), { flow: 'medium', ovulationTest: null });

    const user = userEvent.setup();
    const section = await openToday(user);
    expect(section.queryByText(/Next period/)).not.toBeInTheDocument();

    await user.click(section.getByRole('button', { name: 'Log a Positive ovulation test' }));
    expect(globalThis.localStorage.getItem(`day:${today()}:cycle`) ?? '').toContain(
      '"ovulationTest":"positive"',
    );
    // Measured ovulation tomorrow + default luteal ⇒ a claim appears.
    expect(await section.findByText(/Next period around/)).toBeInTheDocument();

    await user.click(section.getByRole('button', { name: 'Clear the ovulation test' }));
    await waitFor(() => expect(section.queryByText(/Next period/)).not.toBeInTheDocument());
  });

  it('thin history means no estimate — the log alone is the feature (L5)', async () => {
    const user = userEvent.setup();
    const section = await openToday(user);
    await user.click(section.getByRole('button', { name: 'Set flow to Heavy' }));
    expect(section.queryByText(/Next period around/)).not.toBeInTheDocument();
  });
});
