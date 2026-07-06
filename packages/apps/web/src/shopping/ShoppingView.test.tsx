import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, type SliceCodec } from '@almanac/core';
import { mealsDayCodec } from '@almanac/meals';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useShopping } from '../state/shopping';
import { catalog } from '../state/meals-services';
import { dayStore } from '../state/persistence';
import { today } from '../clock';
import i18n from '../i18n/config';

beforeEach(async () => {
  globalThis.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  await i18n.changeLanguage('en');
  useCalendar.setState({ locale: EN_US, view: 'month', anchor: today(), selected: null, starred: {} });
  useShopping.setState({
    loaded: false,
    loading: false,
    settings: null,
    window: null,
    list: null,
    trips: [],
    checked: {},
    manual: [],
  });
});

/** Plan a recipe on today so it falls inside the default "shopping now" window. */
async function planMealToday(): Promise<void> {
  await catalog.saveIngredient({ id: 'onion', name: 'Onion', tags: ['produce'] });
  await catalog.saveIngredient({ id: 'beef', name: 'Beef', tags: ['meat'] });
  await catalog.saveRecipe({
    id: 'stew',
    name: 'Stew',
    tags: [],
    servings: 2,
    ingredients: [
      { ingredientId: 'onion', quantity: { value: 2, unit: 'piece' } },
      { ingredientId: 'beef', quantity: { value: 400, unit: 'g' } },
    ],
  });
  await dayStore.writeSlice(today(), mealsDayCodec as SliceCodec<unknown>, {
    recipeId: 'stew',
    locked: false,
    breakdown: null,
  });
}

async function openShopping(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Shopping' }));
}

describe('shopping UI (§8.1)', () => {
  it('shows an actionable empty state when nothing is planned in the window', async () => {
    const user = userEvent.setup();
    await openShopping(user);
    expect(await screen.findByText(/Nothing to buy/)).toBeInTheDocument();
  });

  it('aggregates the planned meal into an aisle-grouped list', async () => {
    await planMealToday();
    const user = userEvent.setup();
    await openShopping(user);

    await waitFor(() => expect(screen.getByText('Onion')).toBeInTheDocument());
    expect(screen.getByText('Beef')).toBeInTheDocument();
    // Grouped by aisle tag; quantities normalized to base units.
    expect(screen.getByText('produce')).toBeInTheDocument();
    expect(screen.getByText('meat')).toBeInTheDocument();
    expect(screen.getByText('400 g')).toBeInTheDocument();
  });

  it('checks items off and adds a manual item (session state)', async () => {
    await planMealToday();
    const user = userEvent.setup();
    await openShopping(user);

    const onion = await screen.findByRole('checkbox', { name: 'Onion' });
    expect(onion).not.toBeChecked();
    await user.click(onion);
    expect(onion).toBeChecked();

    await user.type(screen.getByLabelText('Add item'), 'Napkins');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getByText('Napkins')).toBeInTheDocument();
  });
});
