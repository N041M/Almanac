import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, type SliceCodec } from '@almanac/core';
import { mealsDayCodec } from '@almanac/meals';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useMacros } from '../state/macros';
import { catalog } from '../state/meals-services';
import { dayStore } from '../state/persistence';
import { today } from '../clock';
import i18n from '../i18n/config';

beforeEach(async () => {
  globalThis.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  await i18n.changeLanguage('en');
  useCalendar.setState({ locale: EN_US, view: 'month', anchor: today(), selected: null, starred: {} });
  useMacros.setState({
    loaded: false,
    loading: false,
    date: today(),
    targets: {},
    slice: { entries: [], plannedServings: 1 },
    plannedRecipe: null,
    ingredients: {},
  });
});

/** A recipe planned on today whose one serving is 295 kcal / 31 g protein. */
async function planMealToday(): Promise<void> {
  await catalog.saveIngredient({
    id: 'chicken',
    name: 'Chicken',
    tags: [],
    nutrition: { per100g: { kcal: 165, proteinG: 31 } },
  });
  await catalog.saveIngredient({
    id: 'rice',
    name: 'Rice',
    tags: [],
    nutrition: { per100g: { kcal: 130, carbsG: 28 } },
  });
  await catalog.saveRecipe({
    id: 'bowl',
    name: 'Chicken & rice',
    tags: [],
    servings: 2,
    ingredients: [
      { ingredientId: 'chicken', quantity: { value: 200, unit: 'g' } },
      { ingredientId: 'rice', quantity: { value: 200, unit: 'g' } },
    ],
  });
  await dayStore.writeSlice(today(), mealsDayCodec as SliceCodec<unknown>, {
    recipeId: 'bowl',
    locked: false,
    breakdown: null,
  });
}

async function openMacros(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Macros' }));
  await screen.findByText('Targets');
}

describe('macros UI (§8)', () => {
  it('auto-fills the planned meal and shows remaining against an editable target', async () => {
    await planMealToday();
    const user = userEvent.setup();
    await openMacros(user);

    // The planned meal is auto-attributed, no manual entry needed.
    await waitFor(() => expect(screen.getByText('Chicken & rice')).toBeInTheDocument());

    // Set a calorie target; remaining = 2000 − 295.
    await user.type(screen.getByLabelText('Targets: Calories'), '2000');
    await waitFor(() => expect(screen.getByText(/1,?705 kcal remaining/)).toBeInTheDocument());
  });

  it('logs a manual entry that adds to intake and persists to the day slice', async () => {
    const user = userEvent.setup();
    await openMacros(user);

    await user.type(screen.getByLabelText('Log food'), 'Protein shake');
    await user.type(screen.getByLabelText('Log food: Protein'), '30');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Protein shake')).toBeInTheDocument();
    await waitFor(() => expect(useMacros.getState().slice.entries).toHaveLength(1));
  });

  it('shows an actionable empty state with no plan, no log, no targets (L5)', async () => {
    const user = userEvent.setup();
    await openMacros(user);
    expect(screen.getByText(/Set a target to start/)).toBeInTheDocument();
    expect(screen.getByText(/No intake logged yet/)).toBeInTheDocument();
  });
});
