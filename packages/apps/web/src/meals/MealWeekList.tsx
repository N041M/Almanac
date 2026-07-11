import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO } from '@almanac/core';
import type { MealSlot } from '@almanac/meals';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { slotLabel } from '../state/meal-slot-label';
import { Button } from '../ui/Button';
import { today } from '../clock';

/**
 * The seven planned days, each with its meal slots (Breakfast/Lunch/Dinner by
 * default). Each slot row: the meal (or an actionable empty slot), lock, and
 * re-roll. Clicking a planned slot opens its "why this pick" panel.
 */
export function MealWeekList() {
  const { t } = useTranslation('meals');
  const locale = useCalendar((s) => s.locale);
  const plan = useMeals((s) => s.plan);
  const slots = useMeals((s) => s.slots);
  const recipes = useMeals((s) => s.recipes);
  const breakdownCell = useMeals((s) => s.breakdownCell);
  const showBreakdown = useMeals((s) => s.showBreakdown);
  const toggleLock = useMeals((s) => s.toggleLock);
  const reroll = useMeals((s) => s.reroll);

  const dayFormat = new Intl.DateTimeFormat(bcp47(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  });
  const isToday = today();
  const slotName = (slot: MealSlot): string => slotLabel(slot, t);

  return (
    <ol className="divide-y divide-line">
      {plan.map((entry, dayIndex) => (
        <li
          key={entry.date}
          className={['px-2 py-2', entry.date === isToday ? 'bg-accent-soft/40' : ''].join(' ')}
        >
          <div className="mb-1 text-sm font-medium capitalize text-ink-muted">
            {dayFormat.format(dateFromISO(entry.date))}
          </div>
          <div className="space-y-1">
            {slots.map((slot) => {
              const cell = entry.slots[slot.id];
              const recipeId = cell?.recipeId ?? null;
              // A meal whose recipe was deleted degrades to a label, not a raw id.
              const name = recipeId === null ? null : (recipes[recipeId]?.name ?? t('removedMeal'));
              const locked = cell?.locked === true;
              const open = breakdownCell?.dayIndex === dayIndex && breakdownCell?.slotId === slot.id;
              return (
                <div
                  key={slot.id}
                  className={['flex items-center gap-2', open ? 'bg-accent-soft/60' : ''].join(' ')}
                >
                  <span className="w-20 shrink-0 text-xs text-ink-muted">{slotName(slot)}</span>
                  {name !== null ? (
                    <button
                      type="button"
                      onClick={() => showBreakdown(open ? null : { dayIndex, slotId: slot.id })}
                      aria-expanded={open}
                      className="min-w-0 flex-1 truncate text-left text-sm hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {name}
                      {locked && <span aria-hidden="true"> 🔒</span>}
                    </button>
                  ) : (
                    <span className="flex-1 text-sm text-ink-muted">{t('emptySlot')}</span>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => void toggleLock(dayIndex, slot.id)}
                    aria-pressed={locked}
                    disabled={recipeId === null}
                  >
                    {locked ? t('unlockDay') : t('lockDay')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void reroll(dayIndex, slot.id)}
                    disabled={locked}
                  >
                    {t('rerollDay')}
                  </Button>
                </div>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}
