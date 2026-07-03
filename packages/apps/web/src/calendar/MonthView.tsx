import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  buildMonthGrid,
  bcp47,
  dateFromISO,
  intensityForPriority,
  MS_PER_DAY,
  type Weekday,
} from '@almanac/core';
import { useCalendar } from '../state/store';
import { Button } from '../ui/Button';
import { today } from '../clock';

/** Localized short weekday labels, ordered from the locale's week-start. */
function weekdayLabels(fmt: Intl.DateTimeFormat, weekStartsOn: Weekday): string[] {
  const sunday = Date.UTC(2023, 0, 1); // 2023-01-01 is a Sunday
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(sunday + ((weekStartsOn + i) % 7) * MS_PER_DAY)),
  );
}

/** The local date, kept current across midnight while the app stays open. */
function useToday(): string {
  const [value, setValue] = useState(today);
  useEffect(() => {
    const id = setInterval(() => {
      const now = today();
      setValue((prev) => (prev === now ? prev : now));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return value;
}

const ARROW_DELTAS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export function MonthView() {
  const { t } = useTranslation();
  const year = useCalendar((s) => s.year);
  const month = useCalendar((s) => s.month);
  const locale = useCalendar((s) => s.locale);
  const selected = useCalendar((s) => s.selected);
  const starred = useCalendar((s) => s.starred);
  const prevMonth = useCalendar((s) => s.prevMonth);
  const nextMonth = useCalendar((s) => s.nextMonth);
  const goToday = useCalendar((s) => s.goToday);
  const select = useCalendar((s) => s.select);
  const loadRange = useCalendar((s) => s.loadRange);

  const tag = bcp47(locale);
  // Intl formatter construction is costly; rebuild only when the locale changes.
  const formatters = useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' }),
      title: new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      cell: new Intl.DateTimeFormat(tag, { dateStyle: 'full', timeZone: 'UTC' }),
    }),
    [tag],
  );

  const todayDate = useToday();
  const grid = useMemo(
    () => buildMonthGrid(year, month, locale.weekStartsOn, todayDate),
    [year, month, locale.weekStartsOn, todayDate],
  );

  const first = grid[0]?.[0]?.date;
  const lastRow = grid[grid.length - 1];
  const last = lastRow?.[lastRow.length - 1]?.date;
  useEffect(() => {
    if (first !== undefined && last !== undefined) void loadRange(first, last);
  }, [first, last, loadRange]);

  const title = formatters.title.format(
    dateFromISO(`${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`),
  );

  // Roving selection: the grid is one tab stop; arrows move the selected day
  // (aria-activedescendant), crossing month edges as needed.
  function onGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    const delta = ARROW_DELTAS[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    select(selected === null ? todayDate : addDays(selected, delta));
  }

  return (
    <section aria-label={t('title')}>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" aria-label={t('prevMonth')} onClick={prevMonth}>
          ‹
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold capitalize">{title}</h2>
          <Button onClick={goToday}>{t('today')}</Button>
        </div>
        <Button variant="ghost" aria-label={t('nextMonth')} onClick={nextMonth}>
          ›
        </Button>
      </div>

      <div
        role="grid"
        aria-label={title}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        aria-activedescendant={selected === null ? undefined : `day-${selected}`}
        className="grid grid-cols-7 gap-1 rounded-xl text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {/* `contents` keeps rows in the ARIA tree without breaking the 7-col grid. */}
        <div role="row" className="contents">
          {weekdayLabels(formatters.weekday, locale.weekStartsOn).map((label) => (
            <div
              key={label}
              role="columnheader"
              className="py-1.5 text-center text-xs font-medium uppercase tracking-wide text-ink-muted"
            >
              {label}
            </div>
          ))}
        </div>

        {grid.map((week, wi) => (
          <div key={week[0]?.date ?? String(wi)} role="row" className="contents">
            {week.map((cell) => {
              const isSelected = cell.date === selected;
              const isStarred = starred[cell.date] ?? false;
              return (
                <button
                  key={cell.date}
                  id={`day-${cell.date}`}
                  role="gridcell"
                  tabIndex={-1}
                  aria-label={formatters.cell.format(dateFromISO(cell.date))}
                  aria-current={cell.isToday ? 'date' : undefined}
                  aria-selected={isSelected}
                  onClick={() => select(cell.date)}
                  className={[
                    'relative aspect-square rounded-lg p-1.5 text-left align-top transition-colors',
                    cell.inMonth ? 'text-ink' : 'text-ink-faint',
                    cell.isToday ? 'ring-1 ring-accent' : '',
                    isSelected ? 'bg-accent-soft' : 'hover:bg-accent-soft/50',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'text-xs tabular-nums',
                      cell.isToday ? 'font-semibold text-accent' : '',
                    ].join(' ')}
                  >
                    {Number(cell.date.slice(8, 10))}
                  </span>
                  {isStarred && (
                    <span
                      aria-label={t('starredLegend')}
                      className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-mark"
                      style={{ opacity: intensityForPriority(1) }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
