import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO, type ISODate } from '@almanac/core';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { Button } from '../ui/Button';

/**
 * The detail content for one day — the surface future module contributions
 * render into. Empty states are actionable, never blank (L5/§9).
 */
export function DayDetail({
  date,
  heading = true,
}: {
  date: ISODate;
  /** Off when the host already titles the day (e.g. the day view's header). */
  heading?: boolean;
}) {
  const { t } = useTranslation();
  const locale = useCalendar((s) => s.locale);
  const starred = useCalendar((s) => s.starred);
  const toggleStar = useCalendar((s) => s.toggleStar);
  // The meals contribution for this day, when the loaded plan covers it — an
  // absent module or uncovered date simply contributes nothing (L5).
  const plannedMeal = useMeals((s) => {
    const entry = s.plan.find((e) => e.date === date && e.recipeId !== null);
    if (entry?.recipeId == null) return undefined;
    return s.recipes[entry.recipeId]?.name ?? entry.recipeId;
  });

  const label = new Intl.DateTimeFormat(bcp47(locale), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dateFromISO(date));
  const isStarred = starred[date] ?? false;

  return (
    <div className="space-y-4">
      {heading && <h3 className="font-semibold capitalize">{label}</h3>}
      {plannedMeal !== undefined ? (
        <p className="text-sm">
          <span className="text-ink-muted">{t('meals:plannedMeal')}: </span>
          {plannedMeal}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">{t('noEntries')}</p>
      )}
      <Button onClick={() => void toggleStar(date)}>
        {isStarred ? t('unstar') : t('star')}
      </Button>
    </div>
  );
}
