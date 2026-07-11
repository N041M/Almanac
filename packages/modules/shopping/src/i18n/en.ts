import type { Messages } from '@almanac/core';

/** English — the guaranteed-complete namespace every other locale falls back to (L7). */
export const en: Messages = {
  title: 'Shopping',
  shoppingNow: 'Shopping now',
  scheduledTrips: 'Scheduled trips',
  shoppingDays: 'Shopping days',
  horizon: 'Shopping horizon',
  addItem: 'Add item',
  removeItem: 'Remove {{name}}',
  itemNamePlaceholder: 'Add an item…',
  otherAisle: 'Other',
  quantityUnknown: 'Quantity unknown',
  emptyList: 'Nothing to buy — no meals are planned in this window.',
  emptyHint: 'Plan some meals, then generate the list.',
  // i18next resolves count → plural suffix (_one/_other; CS adds _few, L7).
  missingRecipes_one: "{{count}} planned meal couldn't be listed",
  missingRecipes_other: "{{count}} planned meals couldn't be listed",
  windowRange: '{{start}} – {{end}}',
};
