import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_CALENDAR_ID, useCalendars } from '../state/calendars';
import { useSubscriptions } from '../state/subscriptions';
import { calendarColorCss } from '../settings/ColorPicker';
import { Popover } from '../ui/Popover';

/**
 * One-tap Calendars panel on the calendar header (Apple-style): toggle each
 * calendar's visibility inline, Show/Hide all, and see subscribed feeds as a
 * read-only group. Hiding is a view filter, never deletion (L5).
 */
export function CalendarsPopover() {
  const { t } = useTranslation();
  const load = useCalendars((s) => s.load);
  const calendars = useCalendars((s) => s.calendars);
  const toggleVisible = useCalendars((s) => s.toggleVisible);
  const setAllVisible = useCalendars((s) => s.setAllVisible);
  const feeds = useSubscriptions((s) => s.feeds);

  useEffect(() => {
    void load();
  }, [load]);

  const display = (id: string, name: string): string =>
    id === DEFAULT_CALENDAR_ID && name === '' ? t('defaultCalendarName') : name;

  return (
    <Popover label={t('calendars')} trigger={t('calendars')} triggerClassName="border border-line">
      {() => (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <span className="text-xs font-medium text-ink-muted">{t('calendars')}</span>
            <span className="flex gap-2 text-xs">
              <button type="button" className="text-accent hover:underline" onClick={() => void setAllVisible(true)}>
                {t('showAll')}
              </button>
              <button type="button" className="text-ink-muted hover:underline" onClick={() => void setAllVisible(false)}>
                {t('hideAll')}
              </button>
            </span>
          </div>
          <ul>
            {calendars.map((cal) => (
              <li key={cal.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent-soft/40">
                  <input
                    type="checkbox"
                    checked={cal.visible}
                    aria-label={t('calendarVisible', { name: display(cal.id, cal.name) })}
                    onChange={() => void toggleVisible(cal.id)}
                    className="accent-accent"
                  />
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: calendarColorCss(cal.hue) }}
                  />
                  <span className="flex-1 truncate">{display(cal.id, cal.name)}</span>
                </label>
              </li>
            ))}
          </ul>
          {feeds.length > 0 && (
            <div className="mt-1 border-t border-line pt-1">
              <span className="px-1 text-xs font-medium text-ink-muted">{t('subscribed')}</span>
              <ul>
                {feeds.map((feed) => (
                  <li key={feed.id} className="flex items-center gap-2 px-1 py-1 text-sm text-ink-muted">
                    <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full bg-ink-faint" />
                    <span className="flex-1 truncate">{feed.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
