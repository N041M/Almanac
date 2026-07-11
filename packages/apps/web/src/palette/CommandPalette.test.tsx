import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, type ISODate } from '@almanac/core';
import type { Task } from '@almanac/tasks';
import { CommandPalette } from './CommandPalette';
import { useCalendar } from '../state/store';
import { useTasks } from '../state/tasks';
import { useMeals } from '../state/meals';
import { today } from '../clock';
import i18n from '../i18n/config';

const dentist: Task = {
  id: 't1',
  kind: 'task',
  title: 'Dentist appointment',
  categories: [],
  contexts: [],
  doneAt: null,
  due: { date: '2026-07-06' as ISODate },
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  useCalendar.setState({ locale: EN_US, view: 'month', anchor: today(), selected: null });
  useTasks.setState({ items: [dentist] });
  useMeals.setState({
    recipes: { r1: { id: 'r1', name: 'Chicken curry', tags: ['spicy'], ingredients: [], servings: 2 } },
  });
});

describe('command palette search (P8 findability)', () => {
  it('surfaces a matching task as a result with its kind, and jumps to its date', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<CommandPalette open onClose={() => {}} onNavigate={onNavigate} />);

    await user.type(screen.getByRole('textbox'), 'dentist');
    const hit = await screen.findByText('Dentist appointment');
    expect(screen.getByText('Task')).toBeInTheDocument();

    await user.click(hit);
    // A dated hit navigates to the calendar and opens that day.
    expect(onNavigate).toHaveBeenCalledWith('calendar');
    expect(useCalendar.getState().view).toBe('day');
    expect(useCalendar.getState().selected).toBe('2026-07-06');
  });

  it('finds a recipe by keyword and routes it to the meals screen', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<CommandPalette open onClose={() => {}} onNavigate={onNavigate} />);

    await user.type(screen.getByRole('textbox'), 'spicy');
    await user.click(await screen.findByText('Chicken curry'));
    expect(onNavigate).toHaveBeenCalledWith('meals');
  });
});
