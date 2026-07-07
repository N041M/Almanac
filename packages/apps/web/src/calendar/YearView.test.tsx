import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, emptyDay, withSlice, type Day, type ISODate } from '@almanac/core';
import { MEALS_NAMESPACE } from '@almanac/meals';
import { YearView } from './YearView';
import { useCalendar } from '../state/store';
import { useTasks } from '../state/tasks';

/** A day carrying a planned meal, so it registers on the density grid. */
function dayWithMeal(date: ISODate): Day {
  return withSlice(emptyDay(date), MEALS_NAMESPACE, { recipeId: 'r1', locked: false, breakdown: null });
}

beforeEach(() => {
  useCalendar.setState({
    locale: EN_US,
    view: 'year',
    anchor: '2026-07-06' as ISODate,
    selected: null,
    days: { '2026-07-06': dayWithMeal('2026-07-06' as ISODate) },
  });
  useTasks.setState({ items: [] });
});

describe('year view (P8)', () => {
  it('renders all twelve months', () => {
    render(<YearView year={2026} />);
    for (const month of ['January', 'February', 'March', 'December']) {
      expect(screen.getByRole('heading', { name: month })).toBeInTheDocument();
    }
  });

  it('shades a day that has contributions', () => {
    render(<YearView year={2026} />);
    // The meal day carries a density background; an empty day does not.
    const dense = screen.getByTitle('2026-07-06');
    expect(dense.className).toContain('bg-accent');
    expect(screen.getByTitle('2026-07-07').className).not.toContain('bg-accent');
  });

  it('clicking a day zooms into its month', async () => {
    const user = userEvent.setup();
    render(<YearView year={2026} />);
    await user.click(screen.getByTitle('2026-07-06'));
    expect(useCalendar.getState().selected).toBe('2026-07-06');
    expect(useCalendar.getState().view).toBe('month');
  });
});
