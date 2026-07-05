import { getSlice, type ISODate } from '@almanac/core';
import { MEALS_NAMESPACE, type MealsDaySlice } from '@almanac/meals';
import { useTranslation } from 'react-i18next';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';

/**
 * The grids' view of module day-contributions: a display chip per date (from
 * the calendar's Day records) and the drop handler that moves an entry
 * between days. Absent module data ⇒ no chip, quietly (L5).
 */
export function useDayChips(): {
  chipFor: (date: ISODate) => string | undefined;
  onDropEntry: (from: ISODate, to: ISODate) => void;
} {
  const { t } = useTranslation('meals');
  const days = useCalendar((s) => s.days);
  const loaded = useMeals((s) => s.loaded);
  const recipes = useMeals((s) => s.recipes);
  const moveMeal = useMeals((s) => s.moveMeal);

  return {
    chipFor: (date) => {
      const day = days[date];
      if (day === undefined || !loaded) return undefined;
      const recipeId = getSlice<MealsDaySlice>(day, MEALS_NAMESPACE)?.recipeId;
      if (recipeId == null) return undefined;
      return recipes[recipeId]?.name ?? t('removedMeal');
    },
    onDropEntry: (from, to) => void moveMeal(from, to),
  };
}
