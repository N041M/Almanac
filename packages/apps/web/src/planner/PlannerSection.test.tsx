import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useTasks } from '../state/tasks';
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
  useTasks.setState({ loaded: false, items: [] });
});

describe('planner (P9) — suggestions the user confirms, never silent moves', () => {
  it('suggests a block for an open due task; confirming creates the event and consumes the suggestion', async () => {
    const user = userEvent.setup();
    // Seed before mount: the section lives on the calendar screen's sidebar
    // and loads tasks itself on first render.
    await useTasks.getState().quickAdd('Write report !1', { date: today() });
    render(<App />);

    const section = within(await screen.findByRole('region', { name: 'Plan my day' }));
    expect(section.getByText('Write report')).toBeInTheDocument();
    expect(section.getByText(/P1/)).toBeInTheDocument(); // the "why" breakdown

    await user.click(section.getByRole('button', { name: 'Add block' }));

    // A busy event now exists with the task's title; the suggestion is gone.
    await waitFor(() => {
      const events = useTasks.getState().items.filter((i) => i.kind === 'event');
      expect(events).toHaveLength(1);
      expect(events[0]?.title).toBe('Write report');
    });
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Plan my day' })).not.toBeInTheDocument(),
    );
  });

  it('dismissing is quiet session state; no open tasks means no section at all (L5)', async () => {
    const user = userEvent.setup();
    await useTasks.getState().quickAdd('Sort inbox', { date: today() });
    render(<App />);

    const section = within(await screen.findByRole('region', { name: 'Plan my day' }));
    await user.click(section.getByRole('button', { name: 'Dismiss Sort inbox' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Plan my day' })).not.toBeInTheDocument(),
    );
    // The task itself is untouched — dismissal never deletes (L5).
    expect(useTasks.getState().items.filter((i) => i.kind === 'task')).toHaveLength(1);
  });
});
