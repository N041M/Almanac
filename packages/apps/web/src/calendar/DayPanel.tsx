import { useTranslation } from 'react-i18next';
import { bcp47 } from '@almanac/core';
import { useCalendar } from '../state/store';
import { dateFromISO } from '../util';

/** Detail panel for the selected day. Empty state is actionable, not blank (L5). */
export function DayPanel() {
  const { t } = useTranslation();
  const selected = useCalendar((s) => s.selected);
  const locale = useCalendar((s) => s.locale);
  const starred = useCalendar((s) => s.starred);
  const toggleStar = useCalendar((s) => s.toggleStar);

  if (selected === null) {
    return <p className="text-sm text-neutral-500">{t('selectDay')}</p>;
  }

  const label = new Intl.DateTimeFormat(bcp47(locale), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dateFromISO(selected));
  const isStarred = starred[selected] ?? false;

  return (
    <div className="space-y-2">
      <h3 className="font-medium capitalize">{label}</h3>
      <button
        onClick={() => void toggleStar(selected)}
        className="rounded border px-2 py-1 text-sm hover:bg-neutral-100"
      >
        {isStarred ? t('unstar') : t('star')}
      </button>
    </div>
  );
}
