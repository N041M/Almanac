import type { Messages } from '@almanac/core';

/** Czech. Any missing key falls back to the English namespace (L7). */
export const cs: Messages = {
  title: 'Nákupy',
  shoppingNow: 'Nakoupit teď',
  scheduledTrips: 'Naplánované nákupy',
  shoppingDays: 'Nákupní dny',
  horizon: 'Horizont nákupu',
  addItem: 'Přidat položku',
  removeItem: 'Odebrat {{name}}',
  itemNamePlaceholder: 'Přidat položku…',
  otherAisle: 'Ostatní',
  quantityUnknown: 'Neznámé množství',
  emptyList: 'Není co nakoupit — v tomto období nejsou naplánovaná žádná jídla.',
  emptyHint: 'Naplánujte nějaká jídla a pak vygenerujte seznam.',
  missingRecipes_one: '{{count}} naplánované jídlo nešlo vypsat',
  missingRecipes_few: '{{count}} naplánovaná jídla nešla vypsat',
  missingRecipes_other: '{{count}} naplánovaných jídel nešlo vypsat',
  windowRange: '{{start}} – {{end}}',
};
