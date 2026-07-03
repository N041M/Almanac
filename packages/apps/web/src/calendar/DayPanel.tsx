import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO } from '@almanac/core';
import { useCalendar } from '../state/store';
import { Button } from '../ui/Button';

/**
 * Detail panel for the selected day — the surface future module contributions
 * render into. Empty states are actionable, never blank (L5/§9).
 */
export function DayPanel() {
  const { t } = useTranslation();
  const selected = useCalendar((s) => s.selected);
  const locale = useCalendar((s) => s.locale);
  const starred = useCalendar((s) => s.starred);
  const toggleStar = useCalendar((s) => s.toggleStar);

  if (selected === null) {
    return <p className="text-sm text-ink-muted">{t('selectDay')}</p>;
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
    <div className="space-y-4">
      <h3 className="font-semibold capitalize">{label}</h3>
      {/* Module contributions for the day will list here (Phase 4+). */}
      <p className="text-sm text-ink-muted">{t('noEntries')}</p>
      <Button onClick={() => void toggleStar(selected)}>
        {isStarred ? t('unstar') : t('star')}
      </Button>
    </div>
  );
}
