import { DEFAULT_MEAL_SLOTS, type MealSlot } from '@almanac/meals';

/**
 * A slot's display name: the built-in slots (Breakfast/Lunch/Dinner) localize
 * through i18n, but once a user renames one, their own name wins (L7 without
 * overriding the user).
 */
export function slotLabel(slot: MealSlot, t: (key: string) => string): string {
  const builtIn = DEFAULT_MEAL_SLOTS.find((d) => d.id === slot.id);
  return builtIn !== undefined && builtIn.name === slot.name ? t(`slot_${slot.id}`) : slot.name;
}
