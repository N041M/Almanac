import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO, type ISODate } from '@almanac/core';
import { useCalendar } from '../state/store';
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
      {/* Module contributions for the day will list here (Phase 4+). */}
      <p className="text-sm text-ink-muted">{t('noEntries')}</p>
      <Button onClick={() => void toggleStar(date)}>
        {isStarred ? t('unstar') : t('star')}
      </Button>
    </div>
  );
}
