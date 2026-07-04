import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { today } from '../clock';
import i18n from '../i18n/config';

beforeEach(async () => {
  globalThis.localStorage.clear();
  await i18n.changeLanguage('en');
  useCalendar.setState({
    locale: EN_US,
    view: 'month',
    anchor: today(),
    selected: null,
    starred: {},
  });
  useMeals.setState({
    loaded: false,
    recipes: {},
    ingredients: {},
    items: [],
    settings: null,
    plan: [],
    breakdownIndex: null,
  });
});

async function openMeals(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Meal planning' }));
  await screen.findByText('Your meals');
}

async function addMeal(user: ReturnType<typeof userEvent.setup>, name: string, tags = '') {
  await user.type(screen.getByLabelText('Meal name'), name);
  if (tags !== '') {
    await user.type(screen.getByLabelText(/Tags/), tags);
  }
  await user.click(screen.getByRole('button', { name: 'Add meal' }));
}

describe('meals UI', () => {
  it('shows an actionable empty state and seven empty slots before any meals exist', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    expect(screen.getByText(/No meals yet/)).toBeInTheDocument();
    expect(screen.getAllByText('No meal planned')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Generate week' })).toBeDisabled();
  });

  it('adds meals with tags and presets; they persist and list with controls', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash', 'czech, hearty');
    await addMeal(user, 'Pasta');

    expect(screen.getByText('Goulash')).toBeInTheDocument();
    expect(screen.getByText('czech · hearty')).toBeInTheDocument();
    expect(screen.getByText('Pasta')).toBeInTheDocument();
    expect(useMeals.getState().items).toHaveLength(2);
    // persisted, not just in memory
    expect(globalThis.localStorage.getItem('meals:items')).toContain('"v":1');
  });

  it('generates a full week, shows the breakdown on click, and locks/re-rolls per day', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await addMeal(user, 'Pasta');
    await addMeal(user, 'Curry');

    await user.click(screen.getByRole('button', { name: 'Generate week' }));
    expect(screen.queryAllByText('No meal planned')).toHaveLength(0);
    const state = useMeals.getState();
    expect(state.plan).toHaveLength(7);
    expect(state.plan.every((entry) => entry.recipeId !== null)).toBe(true);

    // Breakdown: click the first planned day.
    const rows = screen.getAllByRole('listitem');
    const firstMeal = within(rows[0] as HTMLElement).getByRole('button', { expanded: false });
    await user.click(firstMeal);
    expect(screen.getByText(/Selection probability/)).toBeInTheDocument();
    expect(screen.getByText('Never served')).toBeInTheDocument();

    // Lock day 0, re-roll day 1: day 0 must stand, day 1 stays filled.
    const day0 = useMeals.getState().plan[0]?.recipeId;
    await user.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'Lock' }));
    await user.click(within(rows[1] as HTMLElement).getByRole('button', { name: 'Re-roll' }));
    const after = useMeals.getState().plan;
    expect(after[0]?.recipeId).toBe(day0);
    expect(after[0]?.locked).toBe(true);
    expect(after[1]?.recipeId).not.toBeNull();
  });

  it('Next week commits history and moves to a fresh week', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await user.click(screen.getByRole('button', { name: 'Generate week' }));

    const weekBefore = useMeals.getState().settings?.weekStart;
    await user.click(screen.getByRole('button', { name: 'Next week' }));

    const state = useMeals.getState();
    expect(state.settings?.weekStart).not.toBe(weekBefore);
    // history written: the item now carries a lastServed date
    expect(state.items[0]?.lastServed).not.toBeNull();
    // the new week is untouched
    expect(await screen.findAllByText('No meal planned')).toHaveLength(7);
  });

  it('the planned meal surfaces on the calendar day detail (shared day record)', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await user.click(screen.getByRole('button', { name: 'Generate week' }));

    // Today is inside the planned week, so its detail shows the meal.
    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    expect(await screen.findByText('Goulash')).toBeInTheDocument();
    expect(screen.getByText(/Meal:/)).toBeInTheDocument();
  });

  it('adds and removes ingredient lines; the catalog reuses ingredients by name', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await addMeal(user, 'Soup');

    // Open Goulash's ingredients and add two lines.
    const rows = () => screen.getAllByRole('listitem');
    const goulashRow = rows().find((row) => row.textContent?.includes('Goulash')) as HTMLElement;
    await user.click(within(goulashRow).getByRole('button', { name: 'Ingredients (0)' }));
    await user.type(screen.getByLabelText('Ingredient'), 'Onion');
    await user.type(screen.getByLabelText('Amount'), '200');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));
    expect(await within(goulashRow).findByText('Onion')).toBeInTheDocument();
    expect(within(goulashRow).getByText('200 g')).toBeInTheDocument();
    expect(within(goulashRow).getByRole('button', { name: 'Ingredients (1)' })).toBeInTheDocument();

    // The same name in another meal reuses the catalog entry (one Onion app-wide).
    const soupRow = rows().find((row) => row.textContent?.includes('Soup')) as HTMLElement;
    await user.click(within(soupRow).getByRole('button', { name: 'Ingredients (0)' }));
    await user.type(within(soupRow).getByLabelText('Ingredient'), 'onion');
    await user.type(within(soupRow).getByLabelText('Amount'), '1');
    await user.selectOptions(within(soupRow).getByLabelText('Unit'), 'piece');
    await user.click(within(soupRow).getByRole('button', { name: 'Add ingredient' }));
    await within(soupRow).findByText(/onion/i);
    expect(Object.keys(useMeals.getState().ingredients)).toHaveLength(1);

    // Re-open Goulash's editor (opening Soup's closed it) and remove its line.
    await user.click(within(goulashRow).getByRole('button', { name: 'Ingredients (1)' }));
    await user.click(within(goulashRow).getByRole('button', { name: 'Remove Onion' }));
    expect(within(goulashRow).getByRole('button', { name: 'Ingredients (0)' })).toBeInTheDocument();
    // Both meals still exist; only the line went away.
    expect(useMeals.getState().items).toHaveLength(2);
  });

  it('meals switch language with the app (module namespace rides the manifest, L7)', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await user.selectOptions(screen.getByLabelText('Language'), 'cs');
    expect(screen.getByRole('button', { name: 'Vygenerovat týden' })).toBeInTheDocument();
    expect(screen.getByText('Vaše jídla')).toBeInTheDocument();
  });
});
