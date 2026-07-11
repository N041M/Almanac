import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarsManager } from './CalendarsManager';
import { CalendarsPopover } from '../calendar/CalendarsPopover';
import { useCalendars } from '../state/calendars';
import { useSettings } from '../state/settings';
import { useTasks } from '../state/tasks';
import { useSubscriptions } from '../state/subscriptions';
import i18n from '../i18n/config';

beforeEach(async () => {
  globalThis.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  await i18n.changeLanguage('en');
  useCalendars.setState({ loaded: true, calendars: [{ id: 'default', name: '', hue: 220, visible: true }] });
  useSettings.setState({ defaultCalendarId: 'default' });
  useTasks.setState({ items: [] });
  useSubscriptions.setState({ loaded: true, feeds: [] });
});

describe('Apple-inspired calendars (manager)', () => {
  it('renames a calendar in place', async () => {
    const user = userEvent.setup();
    render(<CalendarsManager />);
    await user.type(await screen.findByLabelText('Rename'), 'Home');
    expect(useCalendars.getState().calendars[0]?.name).toBe('Home');
  });

  it('new entries land on the chosen default calendar', async () => {
    await useCalendars.getState().add('Work', 30);
    const workId = useCalendars.getState().calendars.find((c) => c.name === 'Work')?.id as string;
    await useSettings.getState().setDefaultCalendar(workId);

    await useTasks.getState().quickAdd('Buy milk');
    expect(useTasks.getState().items.find((i) => i.title === 'Buy milk')?.calendarId).toBe(workId);
  });
});

describe('Apple-inspired calendars (header popover)', () => {
  it('toggles a calendar and Show/Hide all inline', async () => {
    const user = userEvent.setup();
    render(<CalendarsPopover />);
    await user.click(screen.getByRole('button', { name: 'Calendars' }));

    const checkbox = await screen.findByRole('checkbox');
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(useCalendars.getState().calendars[0]?.visible).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Show all' }));
    expect(useCalendars.getState().calendars.every((c) => c.visible)).toBe(true);
  });

  it('lists subscribed feeds as a read-only group', async () => {
    useSubscriptions.setState({
      loaded: true,
      feeds: [{ id: 'f1', url: 'u', name: 'Holidays', lastFetchedUtc: null, cachedIcs: null, events: [], stale: false }],
    });
    const user = userEvent.setup();
    render(<CalendarsPopover />);
    await user.click(screen.getByRole('button', { name: 'Calendars' }));

    expect(screen.getByText('Subscribed')).toBeInTheDocument();
    expect(screen.getByText('Holidays')).toBeInTheDocument();
  });
});
