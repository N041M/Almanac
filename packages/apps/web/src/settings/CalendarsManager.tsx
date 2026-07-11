import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CALENDAR_COLORS, DEFAULT_CALENDAR_ID, useCalendars, type UserCalendar } from '../state/calendars';
import { useSettings } from '../state/settings';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Select } from '../ui/Input';
import { ColorPicker } from './ColorPicker';

const DEFAULT_HUE = CALENDAR_COLORS[5]?.hue ?? 220; // blue

/** Manage calendars (P6, Apple-inspired): recolour, rename, visibility, default. */
export function CalendarsManager() {
  const { t } = useTranslation();
  const load = useCalendars((s) => s.load);
  const loadSettings = useSettings((s) => s.load);
  const calendars = useCalendars((s) => s.calendars);
  const add = useCalendars((s) => s.add);
  const rename = useCalendars((s) => s.rename);
  const recolor = useCalendars((s) => s.recolor);
  const toggleVisible = useCalendars((s) => s.toggleVisible);
  const remove = useCalendars((s) => s.remove);
  const defaultCalendarId = useSettings((s) => s.defaultCalendarId);
  const setDefaultCalendar = useSettings((s) => s.setDefaultCalendar);

  const [name, setName] = useState('');
  const [hue, setHue] = useState(DEFAULT_HUE);

  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  const display = (cal: UserCalendar): string =>
    cal.id === DEFAULT_CALENDAR_ID && cal.name === '' ? t('defaultCalendarName') : cal.name;

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">{t('calendars')}</h2>

      <ul className="space-y-1.5">
        {calendars.map((cal) => (
          <li key={cal.id} className="flex items-center gap-2 text-sm">
            <ColorPicker hue={cal.hue} onPick={(h) => void recolor(cal.id, h)} label={t('editColor')} />
            <Input
              aria-label={t('renameCalendar')}
              value={cal.name}
              placeholder={cal.id === DEFAULT_CALENDAR_ID ? t('defaultCalendarName') : t('calendarName')}
              onChange={(e) => void rename(cal.id, e.target.value)}
              className="min-w-32 flex-1"
            />
            <label className="flex items-center gap-1.5 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={cal.visible}
                aria-label={t('calendarVisible', { name: display(cal) })}
                onChange={() => void toggleVisible(cal.id)}
                className="accent-accent"
              />
              {t('shown')}
            </label>
            {cal.id !== DEFAULT_CALENDAR_ID && (
              <Button variant="ghost" aria-label={t('removeCalendar')} onClick={() => void remove(cal.id)}>
                ✕
              </Button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() === '') return;
          void add(name, hue);
          setName('');
        }}
      >
        <ColorPicker hue={hue} onPick={setHue} label={t('editColor')} />
        <Input
          aria-label={t('calendarName')}
          placeholder={t('calendarName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-36 flex-1"
        />
        <Button type="submit">{t('addCalendar')}</Button>
      </form>

      <label className="flex items-center gap-2 text-xs text-ink-muted">
        {t('defaultCalendar')}
        <Select
          aria-label={t('defaultCalendar')}
          value={defaultCalendarId}
          onChange={(e) => void setDefaultCalendar(e.target.value)}
        >
          {calendars.map((cal) => (
            <option key={cal.id} value={cal.id}>
              {display(cal)}
            </option>
          ))}
        </Select>
      </label>
    </Card>
  );
}
