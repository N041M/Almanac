/**
 * A meal slot (type) on a day — settings-driven so a user can have more, fewer,
 * or differently-named meals. The engine only needs the ordered ids; the name
 * is a UI concern (the web layer localizes the built-in defaults by id).
 */
export interface MealSlot {
  id: string;
  name: string;
}

/** Default: three meals a day. Names are English; the web localizes by id. */
export const DEFAULT_MEAL_SLOTS: ReadonlyArray<MealSlot> = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'dinner', name: 'Dinner' },
];

/** Legacy single-meal day slices decode into this slot (the day's main meal). */
export const LEGACY_SLOT_ID = 'dinner';

export const MEALS_SLOTS_VERSION = 1;
